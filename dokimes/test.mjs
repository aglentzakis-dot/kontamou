// Αυτόματες δοκιμές κανόνων βάσης «Κοντά μου» στον επίσημο προσομοιωτή της Firebase (Firestore Emulator).
// Κάθε δοκιμή: περιγραφή, αναμενόμενο (ΕΠΙΤΡΕΠΕΤΑΙ / ΑΠΟΡΡΙΠΤΕΤΑΙ), αποτέλεσμα.
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, collection, getDocs, query, where } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";

const RULES = readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "demo-kontamou", firestore: { rules: RULES, host: "127.0.0.1", port: 8080 } });
const OWNER = "aglentzakis.apps@gmail.com", CO = "co@example.com";
const ctx = {
  anon: () => env.unauthenticatedContext().firestore(),
  alice: () => env.authenticatedContext("alice", { email: "alice@example.com", email_verified: true }).firestore(),
  bob: () => env.authenticatedContext("bob", { email: "bob@example.com", email_verified: true }).firestore(),
  eve: () => env.authenticatedContext("eve", { email: "eve@example.com", email_verified: true }).firestore(),
  co: () => env.authenticatedContext("coadmin", { email: CO, email_verified: true }).firestore(),
  owner: () => env.authenticatedContext("owner", { email: OWNER, email_verified: true }).firestore(),
  fakeOwner: () => env.authenticatedContext("fake", { email: OWNER, email_verified: false }).firestore(),
};
const now = () => Timestamp.now(), past = days => Timestamp.fromMillis(Date.now() - days * 864e5);
const profile = (uid, extra = {}) => ({ uid, region: "attiki", type: "pro", name: "Όνομα " + uid, trades: ["electric"], lat: 37.962, lng: 23.754, exact: false, shop: false,
  contact: "request", hidden: false, adminHidden: false, world: "tech", created: now(), ts: past(1), ...extra });

async function seed(){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore(), s = (p, d) => setDoc(doc(db, p), d);
    await s("kontamou_stats/attiki", { name: "Αττική", goal: 4, count: 1, open: true });
    await s("kontamou_config/worlds", { open: ["home", "pets", "car", "learn"] });
    await s("kontamou_admins/" + CO, { name: "Συνδιαχειριστής", by: OWNER, at: now() });
    await s("kontamou_owner/alice", { region: "attiki" });
    await s("kontamou_regions/attiki/profiles/alice", profile("alice"));
    await s("kontamou_private/alice", { uid: "alice", acct: "alice@example.com", phone: "6900000000", email: "", showPhone: true, showEmail: false, ts: now() });
    await s("kontamou_contact/alice", { uid: "alice", mode: "request", phone: "6900000000" });
    await s("kontamou_requests/alice_bob", { pro: "alice", client: "bob", clientName: "Bob", msg: "Βλάβη", status: "pending", ts: past(1) });
    await s("kontamou_favs/bob", { items: {} });
    await s("kontamou_consent/bob", { terms: "2026-10-20", at: now() });
    await s("kontamou_needs/n1", { uid: "bob", name: "Bob", world: "tech", trade: "plumb", region: "attiki", lat: 37.962, lng: 23.754, area: "Βύρωνας", text: "Στάζει η βρύση της κουζίνας", when: "now", status: "open", ts: now() });
    await s("kontamou_acks/a1", { uid: "bob", role: "client", kind: "request", ref: "alice_bob", other: "alice", stmt: "ΠΕΛ-2026-10-20", terms: "2026-10-20", at: now() });
    await s("kontamou_acks/old", { uid: "bob", role: "client", kind: "request", ref: "x", other: "alice", stmt: "ΠΕΛ-2026-10-20", terms: "2026-10-20", at: past(1900) });
    await s("kontamou_deals/alice_bob", { pro: "alice", client: "bob", proName: "Alice", clientName: "Bob", text: "Αλλαγή πρίζας", price: "30 €", when: "", by: "bob", v: 1, okC: now(), ts: past(1) });
    await s("kontamou_reports/alice_bob", { to: "alice", from: "bob", reason: "Απάτη ή εξαπάτηση", text: "Ζήτησε προκαταβολή", region: "attiki", case: "ΑΝ-261020-AAAA", status: "open", ts: past(1) });
    await s("kontamou_reports/closedold", { to: "alice", from: "bob", reason: "Άλλο", text: "", region: "attiki", case: "ΑΝ-250101-BBBB", status: "closed", ts: past(400), hist: [], closedAt: past(200), outcome: "Δεν βρέθηκε παράβαση" });
    await s("kontamou_log/l1", { uid: "bob", name: "Bob", act: "request", ref: "alice", ts: now() });
    await s("kontamou_log/lold", { uid: "bob", name: "Bob", act: "request", ref: "alice", ts: past(400) });
  });
}

const out = []; let pass = 0, fail = 0;
async function t(group, name, expect, fn){
  await seed();
  let ok, err = "";
  try { if (expect) await assertSucceeds(fn()); else await assertFails(fn()); ok = true; }
  catch(e){ ok = false; err = String(e && e.message || e).split("\n")[0].slice(0, 200); }
  ok ? pass++ : fail++;
  out.push({ group, name, expect: expect ? "ΕΠΙΤΡΕΠΕΤΑΙ" : "ΑΠΟΡΡΙΠΤΕΤΑΙ", result: ok ? "ΣΩΣΤΟ" : "ΛΑΘΟΣ", err });
  console.log((ok ? "✓" : "✗") + " [" + group + "] " + name + (ok ? "" : "  → " + err));
}
const withRate = (db, uid, ops) => { db = db;  const b = writeBatch(db); b.set(doc(db, "kontamou_rate/" + uid), { t: serverTimestamp() }); ops(b, db); return b.commit(); };

const G1 = "Απομόνωση χρηστών";
await t(G1, "Ανώνυμος δεν διαβάζει προφίλ", false, () => getDoc(doc(ctx.anon(), "kontamou_regions/attiki/profiles/alice")));
await t(G1, "Άλλος χρήστης δεν διαβάζει ιδιωτικά στοιχεία", false, () => getDoc(doc(ctx.eve(), "kontamou_private/alice")));
await t(G1, "Άλλος χρήστης δεν αλλάζει ιδιωτικά στοιχεία", false, () => setDoc(doc(ctx.eve(), "kontamou_private/alice"), { uid: "alice", phone: "1", ts: serverTimestamp() }));
await t(G1, "Άλλος χρήστης δεν αλλάζει ξένο προφίλ", false, () => updateDoc(doc(ctx.eve(), "kontamou_regions/attiki/profiles/alice"), { name: "Χακαρισμένο", ts: serverTimestamp() }));
await t(G1, "Άλλος χρήστης δεν σβήνει ξένο προφίλ", false, () => deleteDoc(doc(ctx.eve(), "kontamou_regions/attiki/profiles/alice")));
await t(G1, "Τηλέφωνο με «αίτημα επικοινωνίας» δεν φαίνεται χωρίς αποδοχή", false, () => getDoc(doc(ctx.eve(), "kontamou_contact/alice")));
await t(G1, "Τρίτος δεν διαβάζει ξένο αίτημα", false, () => getDoc(doc(ctx.eve(), "kontamou_requests/alice_bob")));
await t(G1, "Ο πελάτης δεν αποδέχεται μόνος του το αίτημά του", false, () => updateDoc(doc(ctx.bob(), "kontamou_requests/alice_bob"), { status: "accepted", ts: serverTimestamp() }));
await t(G1, "Ο επαγγελματίας αποδέχεται αίτημα (έλεγχος ελέγχου)", true, () => updateDoc(doc(ctx.alice(), "kontamou_requests/alice_bob"), { status: "accepted", ts: serverTimestamp() }));
await t(G1, "Τρίτος δεν στέλνει αίτημα στο όνομα άλλου", false, () => withRate(ctx.eve(), "eve", (b, db) => b.set(doc(db, "kontamou_requests/alice_bob"), { pro: "alice", client: "bob", clientName: "Bob", msg: "x", status: "pending", ts: serverTimestamp() })));
await t(G1, "Τρίτος δεν διαβάζει ξένα αγαπημένα", false, () => getDoc(doc(ctx.eve(), "kontamou_favs/bob")));
await t(G1, "Τρίτος δεν διαβάζει ξένη αποδοχή όρων", false, () => getDoc(doc(ctx.eve(), "kontamou_consent/bob")));
await t(G1, "Τρίτος χωρίς προφίλ δεν διαβάζει ζητήσεις", false, () => getDoc(doc(ctx.eve(), "kontamou_needs/n1")));
await t(G1, "Τρίτος δεν σβήνει ξένη ζήτηση", false, () => deleteDoc(doc(ctx.eve(), "kontamou_needs/n1")));
await t(G1, "Ο χρήστης δεν βάζει μόνος του ✓ «ελεγμένος»", false, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { verified: true, ts: serverTimestamp() }));
await t(G1, "Ο χρήστης δεν βάζει μόνος του προνομιακή προβολή", false, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { featured: true, ts: serverTimestamp() }));
await t(G1, "Ο χρήστης δεν ξεκρύβει προφίλ που έκρυψε ο διαχειριστής", false, async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_regions/attiki/profiles/alice"), { adminHidden: true }));
  return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { adminHidden: false, ts: serverTimestamp() }); });
await t(G1, "Χρήστης δεν γίνεται διαχειριστής", false, () => setDoc(doc(ctx.eve(), "kontamou_admins/eve@example.com"), { name: "eve", by: "eve", at: serverTimestamp() }));
await t(G1, "Συνδιαχειριστής δεν προσθέτει άλλους διαχειριστές", false, () => setDoc(doc(ctx.co(), "kontamou_admins/x@example.com"), { name: "x", by: CO, at: serverTimestamp() }));
await t(G1, "Ψεύτικος «κύριος» με μη επιβεβαιωμένο email δεν περνά", false, () => getDoc(doc(ctx.fakeOwner(), "kontamou_private/alice")));
await t(G1, "Χρήστης δεν ανοίγει περιοχή", false, () => updateDoc(doc(ctx.eve(), "kontamou_stats/attiki"), { open: false }));
await t(G1, "Χρήστης δεν διαβάζει αποκλεισμούς άλλων", false, () => getDoc(doc(ctx.eve(), "kontamou_bans/alice")));
await t(G1, "Χρήστης δεν διαβάζει τον κάδο", false, () => getDocs(collection(ctx.eve(), "kontamou_trash")));

const G2 = "Αποκλεισμός υγείας και ανηλίκων";
const newProf = (db, uid, extra) => { const b = writeBatch(db); b.set(doc(db, "kontamou_owner/" + uid), { region: "attiki" }); b.set(doc(db, "kontamou_regions/attiki/profiles/" + uid), { ...profile(uid), created: serverTimestamp(), ts: serverTimestamp(), ...extra }); return b.commit(); };
await t(G2, "Έλεγχος ελέγχου: κανονικό προφίλ μαθημάτων για ενήλικες", true, () => newProf(ctx.eve(), "eve", { world: "learn", trades: ["l_en"], levels: ["adult"] }));
await t(G2, "Προφίλ στον κόσμο «Υγεία» απορρίπτεται", false, () => newProf(ctx.eve(), "eve", { world: "health", trades: ["md_nurse"] }));
await t(G2, "Μαθήματα για Δημοτικό απορρίπτονται", false, () => newProf(ctx.eve(), "eve", { world: "learn", trades: ["l_en"], levels: ["dim"] }));
await t(G2, "Σχολικά μαθήματα (μαθηματικά) απορρίπτονται", false, () => newProf(ctx.eve(), "eve", { world: "learn", trades: ["l_math"], levels: ["adult"] }));
await t(G2, "Ειδική αγωγή απορρίπτεται", false, () => newProf(ctx.eve(), "eve", { world: "learn", trades: ["l_sped"], levels: ["adult"] }));
await t(G2, "Βοήθεια ηλικιωμένων (ψώνια) απορρίπτεται", false, () => newProf(ctx.eve(), "eve", { world: "errands", trades: ["e_shop"] }));
await t(G2, "Ειδικότητα υγείας μέσα σε άλλο κόσμο απορρίπτεται", false, () => newProf(ctx.eve(), "eve", { world: "tech", trades: ["md_nurse"] }));
await t(G2, "Υπάρχον προφίλ δεν μεταφέρεται στην «Υγεία»", false, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "health", trades: ["md_doc"], ts: serverTimestamp() }));
const need = extra => ({ uid: "bob", name: "Bob", world: "tech", trade: "plumb", region: "attiki", lat: 37.962, lng: 23.754, area: "Βύρωνας", text: "Χρειάζομαι βοήθεια άμεσα", when: "now", status: "open", ts: serverTimestamp(), ...extra });
await t(G2, "Έλεγχος ελέγχου: κανονική ζήτηση", true, () => withRate(ctx.bob(), "bob", (b, db) => b.set(doc(db, "kontamou_needs/n2"), need({}))));
await t(G2, "Ζήτηση στον κόσμο «Υγεία» απορρίπτεται", false, () => withRate(ctx.bob(), "bob", (b, db) => b.set(doc(db, "kontamou_needs/n2"), need({ world: "health", trade: "md_nurse" }))));
await t(G2, "Ζήτηση για ειδική αγωγή απορρίπτεται", false, () => withRate(ctx.bob(), "bob", (b, db) => b.set(doc(db, "kontamou_needs/n2"), need({ world: "learn", trade: "l_sped" }))));

const G3 = "Αποδεικτικά αποδοχής";
const ack = extra => ({ uid: "bob", role: "client", kind: "request", ref: "alice_bob", other: "alice", stmt: "ΠΕΛ-2026-10-20", terms: "2026-10-20", at: serverTimestamp(), ...extra });
await t(G3, "Ο χρήστης γράφει δικό του αποδεικτικό (έλεγχος ελέγχου)", true, () => setDoc(doc(ctx.bob(), "kontamou_acks/a2"), ack({})));
await t(G3, "Πλαστό αποδεικτικό στο όνομα άλλου απορρίπτεται", false, () => setDoc(doc(ctx.eve(), "kontamou_acks/a2"), ack({})));
await t(G3, "Αποδεικτικό με ψεύτικη (παλιά) ημερομηνία απορρίπτεται", false, () => setDoc(doc(ctx.bob(), "kontamou_acks/a2"), ack({ at: past(30) })));
await t(G3, "Άγνωστο είδος αποδεικτικού απορρίπτεται", false, () => setDoc(doc(ctx.bob(), "kontamou_acks/a2"), ack({ kind: "κάτι" })));
await t(G3, "Ο χρήστης δεν αλλάζει το αποδεικτικό του", false, () => updateDoc(doc(ctx.bob(), "kontamou_acks/a1"), { stmt: "ΑΛΛΟ" }));
await t(G3, "Ο χρήστης δεν σβήνει το αποδεικτικό του", false, () => deleteDoc(doc(ctx.bob(), "kontamou_acks/a1")));
await t(G3, "Τρίτος δεν διαβάζει ξένο αποδεικτικό", false, () => getDoc(doc(ctx.eve(), "kontamou_acks/a1")));
await t(G3, "Ο ίδιος διαβάζει το αποδεικτικό του", true, () => getDoc(doc(ctx.bob(), "kontamou_acks/a1")));
await t(G3, "Συνδιαχειριστής δεν πλαστογραφεί αποδεικτικό", false, () => setDoc(doc(ctx.co(), "kontamou_acks/a3"), ack({})));
await t(G3, "Διαχειριστής δεν αλλάζει αποδεικτικό", false, () => updateDoc(doc(ctx.owner(), "kontamou_acks/a1"), { stmt: "ΑΛΛΟ" }));
await t(G3, "Διαχειριστής δεν σβήνει πρόσφατο αποδεικτικό", false, () => deleteDoc(doc(ctx.owner(), "kontamou_acks/a1")));
await t(G3, "Διαχειριστής σβήνει αποδεικτικό μετά από 5 χρόνια", true, () => deleteDoc(doc(ctx.co(), "kontamou_acks/old")));
await t(G3, "Δήλωση ανεξαρτησίας: τρίτος δεν τη γράφει για άλλον", false, () => setDoc(doc(ctx.eve(), "kontamou_acks/a4"), ack({ role: "pro", kind: "profile", ref: "alice", other: "" , uid: "alice" })));

const G4 = "Καταγραφές συμφωνίας";
await t(G4, "Τρίτος δεν διαβάζει ξένη συμφωνία", false, () => getDoc(doc(ctx.eve(), "kontamou_deals/alice_bob")));
await t(G4, "Τρίτος δεν φτιάχνει συμφωνία για άλλους", false, () => setDoc(doc(ctx.eve(), "kontamou_deals/alice_bob2"), { pro: "alice", client: "bob2", proName: "A", clientName: "B", text: "Κάτι εργασία", price: "", when: "", by: "eve", v: 1, okC: serverTimestamp(), ts: serverTimestamp() }));
await t(G4, "Ο πελάτης δεν αποδέχεται για λογαριασμό του επαγγελματία", false, () => updateDoc(doc(ctx.bob(), "kontamou_deals/alice_bob"), { okP: serverTimestamp() }));
await t(G4, "Ο επαγγελματίας αποδέχεται (έλεγχος ελέγχου)", true, () => updateDoc(doc(ctx.alice(), "kontamou_deals/alice_bob"), { okP: serverTimestamp() }));
await t(G4, "Αλλαγή χωρίς νέα έκδοση απορρίπτεται", false, () => updateDoc(doc(ctx.bob(), "kontamou_deals/alice_bob"), { text: "Άλλη τιμή εργασίας", by: "bob", ts: serverTimestamp(), okC: serverTimestamp() }));
await t(G4, "Αλλαγή που κρατά την αποδοχή του άλλου απορρίπτεται", false, async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_deals/alice_bob"), { okP: now() }));
  return updateDoc(doc(ctx.bob(), "kontamou_deals/alice_bob"), { text: "Άλλη τιμή εργασίας", by: "bob", v: 2, ts: serverTimestamp(), okC: serverTimestamp() }); });
await t(G4, "Σωστή αλλαγή (νέα έκδοση, μόνο η δική μου αποδοχή)", true, () => updateDoc(doc(ctx.bob(), "kontamou_deals/alice_bob"), { text: "Άλλη τιμή εργασίας", by: "bob", v: 2, ts: serverTimestamp(), okC: serverTimestamp() }));
await t(G4, "Τα μέρη δεν σβήνουν τη συμφωνία", false, () => deleteDoc(doc(ctx.bob(), "kontamou_deals/alice_bob")));
await t(G4, "Διαχειριστής δεν σβήνει πρόσφατη συμφωνία", false, () => deleteDoc(doc(ctx.co(), "kontamou_deals/alice_bob")));

const G5 = "Καταγγελίες και επανεξέταση";
const rep = extra => ({ to: "alice", from: "bob", reason: "Απάτη ή εξαπάτηση", text: "Ζήτησε χρήματα", region: "attiki", case: "ΑΝ-261020-CCCC", status: "open", ts: serverTimestamp(), ...extra });
await t(G5, "Ο χρήστης κάνει καταγγελία (έλεγχος ελέγχου)", true, () => withRate(ctx.bob(), "bob", (b, db) => b.set(doc(db, "kontamou_reports/alice_bob_1700000000000"), rep({}))));
await t(G5, "Καταγγελία στο όνομα άλλου απορρίπτεται", false, () => withRate(ctx.eve(), "eve", (b, db) => b.set(doc(db, "kontamou_reports/alice_bob_1700000000001"), rep({}))));
await t(G5, "Καταγγελία που γεννιέται «κλειστή» απορρίπτεται", false, () => withRate(ctx.bob(), "bob", (b, db) => b.set(doc(db, "kontamou_reports/alice_bob_1700000000002"), rep({ status: "closed" }))));
await t(G5, "Ο καταγγέλλων βλέπει την καταγγελία του", true, () => getDoc(doc(ctx.bob(), "kontamou_reports/alice_bob")));
await t(G5, "Ο καταγγελλόμενος δεν βλέπει την καταγγελία", false, () => getDoc(doc(ctx.alice(), "kontamou_reports/alice_bob")));
await t(G5, "Ο καταγγέλλων δεν αλλάζει την κατάσταση", false, () => updateDoc(doc(ctx.bob(), "kontamou_reports/alice_bob"), { status: "closed" }));
await t(G5, "Διαχειριστής βάζει «σε εξέταση» με νέα εγγραφή ιστορικού", true, () => updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "", by: CO }], upd: serverTimestamp() }));
await t(G5, "Εγγραφή ιστορικού με ξένο email απορρίπτεται", false, () => updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "", by: OWNER }], upd: serverTimestamp() }));
await t(G5, "Δεύτερη εγγραφή σε υπάρχον ιστορικό επιτρέπεται", true, async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "αρχικό", by: CO }] }));
  return updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "αρχικό", by: CO }, { at: 2, st: "review", note: "", by: CO }], upd: serverTimestamp() }); });
await t(G5, "Διαχειριστής δεν ξαναγράφει παλιό ιστορικό", false, async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "αρχικό", by: CO }] }));
  return updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "αλλαγμένο", by: CO }, { at: 2, st: "review", note: "", by: CO }], upd: serverTimestamp() }); });
await t(G5, "Διαχειριστής δεν σβήνει ιστορικό", false, async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_reports/alice_bob"), { status: "review", hist: [{ at: 1, st: "review", note: "", by: CO }] }));
  return updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "review", hist: [], upd: serverTimestamp() }); });
await t(G5, "Διαχειριστής δεν αλλάζει το κείμενο της καταγγελίας", false, () => updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { text: "άλλο", status: "review", hist: [{ at: 1, st: "review", note: "", by: CO }], upd: serverTimestamp() }));
await t(G5, "Κλείσιμο με αποτέλεσμα", true, () => updateDoc(doc(ctx.co(), "kontamou_reports/alice_bob"), { status: "closed", outcome: "Το προφίλ κρύφτηκε", closedAt: serverTimestamp(), hist: [{ at: 1, st: "closed", note: "", by: CO }], upd: serverTimestamp() }));
await t(G5, "Κλειστή υπόθεση δεν αλλάζει αποτέλεσμα", false, () => updateDoc(doc(ctx.co(), "kontamou_reports/closedold"), { status: "closed", outcome: "Άλλο αποτέλεσμα", closedAt: serverTimestamp(), hist: [{ at: 1, st: "closed", note: "", by: CO }], upd: serverTimestamp() }));
await t(G5, "Διαχειριστής δεν σβήνει ανοιχτή καταγγελία", false, () => deleteDoc(doc(ctx.co(), "kontamou_reports/alice_bob")));
await t(G5, "Κλειστή καταγγελία σβήνεται μετά από 180 ημέρες", true, () => deleteDoc(doc(ctx.co(), "kontamou_reports/closedold")));
const app = extra => ({ to: "alice", from: "alice", reason: "Αίτημα επανεξέτασης (ένσταση)", text: "Τα διόρθωσα", region: "attiki", case: "ΑΝ-261020-DDDD", status: "open", ts: serverTimestamp(), ...extra });
await t(G5, "Κρυμμένος χρήστης ζητά επανεξέταση", true, () => withRate(ctx.alice(), "alice", (b, db) => b.set(doc(db, "kontamou_reports/alice_appeal_1700000000000"), app({}))));
await t(G5, "Αποκλεισμένος χρήστης μπορεί να ζητήσει επανεξέταση", true, async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_bans/alice"), { name: "Alice", why: "Απάτη", at: now() }));
  return withRate(ctx.alice(), "alice", (b, db) => b.set(doc(db, "kontamou_reports/alice_appeal_1700000000005"), app({}))); });
await t(G5, "Αποκλεισμένος χρήστης δεν στέλνει αίτημα επικοινωνίας", false, async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_bans/eve"), { name: "Eve", why: "Απάτη", at: now() }));
  return withRate(ctx.eve(), "eve", (b, db) => b.set(doc(db, "kontamou_requests/alice_eve"), { pro: "alice", client: "eve", clientName: "Eve", msg: "x", status: "pending", ts: serverTimestamp() })); });
await t(G5, "Επανεξέταση με άλλο λόγο απορρίπτεται", false, () => withRate(ctx.alice(), "alice", (b, db) => b.set(doc(db, "kontamou_reports/alice_appeal_1700000000000"), app({ reason: "Άλλο" }))));
await t(G5, "Τρίτος δεν ζητά επανεξέταση για άλλον", false, () => withRate(ctx.eve(), "eve", (b, db) => b.set(doc(db, "kontamou_reports/alice_appeal_1700000000000"), app({ from: "eve" }))));
await t(G5, "Συνδιαχειριστής δεν φτιάχνει καταγγελία για λογαριασμό άλλου", false, () => setDoc(doc(ctx.co(), "kontamou_reports/alice_bob_1700000000009"), rep({ from: "bob" })));

const G6 = "Αρχείο ενεργειών";
const log = (uid, extra) => ({ uid, name: "x", act: "admin", ref: "δοκιμή", ts: serverTimestamp(), ...extra });
await t(G6, "Χρήστης γράφει δική του εγγραφή (έλεγχος ελέγχου)", true, () => setDoc(doc(ctx.bob(), "kontamou_log/l2"), log("bob", { act: "request" })));
await t(G6, "Πλαστή εγγραφή στο όνομα άλλου απορρίπτεται", false, () => setDoc(doc(ctx.eve(), "kontamou_log/l2"), log("alice", { act: "request" })));
await t(G6, "Διαχειριστής δεν γράφει εγγραφή στο όνομα άλλου", false, () => setDoc(doc(ctx.co(), "kontamou_log/l2"), log("bob")));
await t(G6, "Διαχειριστής δεν γράφει εγγραφή με παλιά ημερομηνία", false, () => setDoc(doc(ctx.co(), "kontamou_log/l2"), log("coadmin", { ts: past(10) })));
await t(G6, "Διαχειριστής καταγράφει τη δική του ενέργεια", true, () => setDoc(doc(ctx.co(), "kontamou_log/l2"), log("coadmin")));
await t(G6, "Κανείς δεν αλλάζει εγγραφή", false, () => updateDoc(doc(ctx.owner(), "kontamou_log/l1"), { ref: "άλλο" }));
await t(G6, "Κύριος διαχειριστής δεν σβήνει πρόσφατη εγγραφή", false, () => deleteDoc(doc(ctx.owner(), "kontamou_log/l1")));
await t(G6, "Εγγραφή σβήνεται μόνο μετά από 12 μήνες", true, () => deleteDoc(doc(ctx.co(), "kontamou_log/lold")));
await t(G6, "Χρήστης δεν διαβάζει το αρχείο", false, () => getDocs(collection(ctx.eve(), "kontamou_log")));

const G7 = "Διαγραφή και λήψη δεδομένων από τον ίδιο";
await t(G7, "Ο χρήστης σβήνει το προφίλ του", true, () => deleteDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice")));
await t(G7, "Ο χρήστης σβήνει τα ιδιωτικά του", true, () => deleteDoc(doc(ctx.alice(), "kontamou_private/alice")));
await t(G7, "Ο χρήστης σβήνει την αποδοχή όρων του", true, () => deleteDoc(doc(ctx.bob(), "kontamou_consent/bob")));
await t(G7, "Ο χρήστης διαβάζει τα αιτήματά του (για λήψη)", true, () => getDocs(query(collection(ctx.bob(), "kontamou_requests"), where("client", "==", "bob"))));
await t(G7, "Ο χρήστης διαβάζει τα αποδεικτικά του (για λήψη)", true, () => getDocs(query(collection(ctx.bob(), "kontamou_acks"), where("uid", "==", "bob"))));
await t(G7, "Ο χρήστης δεν διαβάζει μαζικά ξένα αποδεικτικά", false, () => getDocs(collection(ctx.bob(), "kontamou_acks")));

const G8 = "Βιβλία & Πολιτισμός (1.41)";
const openCul = () => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_config/worlds"), { open: ["home", "pets", "car", "learn", "culture"] }));
const putW = (id, d) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_works/" + id), d));
const work = (uid, extra = {}) => ({ uid, title: "Το βιβλίο μου", by: "Συγγραφέας", genre: "novel", lang: "el", link: "https://drive.google.com/file/d/abc/view", stmt: "ΔΙΚ-2026-11-04", status: "pending", ts: serverTimestamp(), ...extra });
const ev = (uid, extra = {}) => ({ uid, world: "culture", title: "Παρουσίαση βιβλίου", kind: "present", start: Timestamp.fromMillis(Date.now() + 5 * 864e5), place: "Βιβλιοπωλείο, Οδός 1", area: "Κέντρο", region: "attiki",
  lat: 37.962, lng: 23.754, adults: true, status: "pending", ts: serverTimestamp(), ...extra });
const wset = (who, uid, id, d) => withRate(ctx[who](), uid, (b, db) => b.set(doc(db, "kontamou_works/" + id), d));
const eset = (who, uid, id, d) => withRate(ctx[who](), uid, (b, db) => b.set(doc(db, "kontamou_events/" + id), d));
await t(G8, "Κλειστός κόσμος: χρήστης δεν προσθέτει έργο", false, () => wset("alice", "alice", "alice_w0", work("alice")));
await t(G8, "Κλειστός κόσμος: χρήστης δεν διαβάζει δημοσιευμένα έργα", false, async () => { await putW("alice_w0", { ...work("alice"), status: "ok", ts: now() }); return getDocs(query(collection(ctx.bob(), "kontamou_works"), where("status", "==", "ok"))); });
await t(G8, "Κλειστός κόσμος: ο διαχειριστής δοκιμάζει (προσθέτει έργο)", true, () => setDoc(doc(ctx.owner(), "kontamou_works/owner_w0"), work("owner", { status: "ok" })));
await t(G8, "Κλειστός κόσμος: χρήστης δεν βάζει προφίλ στον κόσμο πολιτισμού", false, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "culture", trades: ["k_bookshop"], ts: serverTimestamp() }));
await t(G8, "Ανοιχτός: χρήστης προσθέτει έργο για έλεγχο", true, async () => { await openCul(); return wset("alice", "alice", "alice_w0", work("alice")); });
await t(G8, "Ανοιχτός: χρήστης δεν αυτοεγκρίνει έργο (status ok)", false, async () => { await openCul(); return wset("alice", "alice", "alice_w0", work("alice", { status: "ok" })); });
await t(G8, "Ανοιχτός: σύνδεσμος χωρίς https απορρίπτεται", false, async () => { await openCul(); return wset("alice", "alice", "alice_w0", work("alice", { link: "http://drive.google.com/x" })); });
await t(G8, "Ανοιχτός: σύνδεσμος javascript: απορρίπτεται", false, async () => { await openCul(); return wset("alice", "alice", "alice_w0", work("alice", { link: "javascript:alert(1)" })); });
await t(G8, "Ανοιχτός: έργο με αρχείο μέσα στη βάση απορρίπτεται", false, async () => { await openCul(); return wset("alice", "alice", "alice_w0", work("alice", { file: "data:application/pdf;base64,AAAA" })); });
await t(G8, "Ανοιχτός: έργο στο όνομα άλλου απορρίπτεται", false, async () => { await openCul(); return wset("eve", "eve", "alice_w1", work("alice")); });
await t(G8, "Ανοιχτός: πάνω από 100 έργα ανά χρήστη απορρίπτεται (αριθμός θέσης)", false, async () => { await openCul(); return wset("alice", "alice", "alice_w100", work("alice")); });
await t(G8, "Ανοιχτός: τρίτος δεν διαβάζει έργο σε έλεγχο", false, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), ts: now() }); return getDoc(doc(ctx.bob(), "kontamou_works/alice_w0")); });
await t(G8, "Ανοιχτός: τρίτος διαβάζει εγκεκριμένο έργο", true, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), status: "ok", ts: now() }); return getDoc(doc(ctx.bob(), "kontamou_works/alice_w0")); });
await t(G8, "Ανοιχτός: ο δημιουργός δεν εγκρίνει μόνος του αλλάζοντας το έργο", false, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), ts: now() }); return withRate(ctx.alice(), "alice", (b, db) => b.update(doc(db, "kontamou_works/alice_w0"), { status: "ok", ts: serverTimestamp() })); });
await t(G8, "Ανοιχτός: ο δημιουργός δεν γράφει σημείωση διαχειριστή", false, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), ts: now() }); return wset("alice", "alice", "alice_w0", work("alice", { note: "εγκρίθηκε" })); });
await t(G8, "Συνδιαχειριστής εγκρίνει έργο", true, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), ts: now() }); return updateDoc(doc(ctx.co(), "kontamou_works/alice_w0"), { status: "ok" }); });
await t(G8, "Τρίτος δεν σβήνει ξένο έργο", false, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), status: "ok", ts: now() }); return deleteDoc(doc(ctx.eve(), "kontamou_works/alice_w0")); });
await t(G8, "Ο δημιουργός σβήνει το έργο του", true, async () => { await openCul(); await putW("alice_w0", { ...work("alice"), status: "ok", ts: now() }); return deleteDoc(doc(ctx.alice(), "kontamou_works/alice_w0")); });
await t(G8, "1.45: εκδήλωση πολιτισμού στη βάση δεν γίνεται πια (πέρασε στον κόσμο «Εκδηλώσεις»)", false, async () => { await openCul(); return eset("alice", "alice", "alice_e0", ev("alice")); });
await t(G8, "Εκδήλωση χωρίς δήλωση «για ενήλικες» απορρίπτεται", false, async () => { await openCul(); return eset("alice", "alice", "alice_e0", ev("alice", { adults: false })); });
await t(G8, "Εκδήλωση σε παρελθούσα ημερομηνία απορρίπτεται", false, async () => { await openCul(); return eset("alice", "alice", "alice_e0", ev("alice", { start: past(1) })); });
await t(G8, "Εκδήλωση με ακριβές σημείο (όχι στρογγυλεμένο) απορρίπτεται", false, async () => { await openCul(); return eset("alice", "alice", "alice_e0", ev("alice", { lat: 37.96234, lng: 23.75411 })); });
await t(G8, "Εκδήλωση αυτοεγκεκριμένη απορρίπτεται", false, async () => { await openCul(); return eset("alice", "alice", "alice_e0", ev("alice", { status: "ok" })); });
await t(G8, "Συγγραφέας με ακριβές σημείο απορρίπτεται", false, async () => { await openCul(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "culture", trades: ["k_author"], exact: true, ts: serverTimestamp() }); });
await t(G8, "Συγγραφέας μόνο με περιοχή επιτρέπεται", true, async () => { await openCul(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "culture", trades: ["k_author"], exact: false, shop: false, ts: serverTimestamp() }); });
await t(G8, "Βιβλιοπωλείο με ακριβές σημείο καταστήματος επιτρέπεται", true, async () => { await openCul(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "culture", trades: ["k_bookshop"], exact: true, shop: true, lat: 37.96234, lng: 23.75411, ts: serverTimestamp() }); });
await t(G8, "Δήλωση δικαιωμάτων καταγράφεται ως αμετάβλητη απόδειξη", true, () => setDoc(doc(ctx.alice(), "kontamou_acks/r1"), { uid: "alice", role: "pro", kind: "work", ref: "alice_w0", other: "", stmt: "ΔΙΚ-2026-11-04", terms: "2026-10-24", at: serverTimestamp() }));

const G9 = "Κατοικίδια: καταστήματα, εκδηλώσεις, ανοιχτά δεδομένα (1.42)";
const openPx = () => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_config/worlds"), { open: ["home", "pets", "car", "learn", "petsx"] }));
const req = (uid, key, extra = {}) => ({ uid, key, world: "pets", name: "Pet shop", kind: "remove", why: "Έκλεισε", ts: serverTimestamp(), ...extra });
const rset = (who, uid, id, d) => withRate(ctx[who](), uid, (b, db) => b.set(doc(db, "kontamou_osmreq/" + id), d));
await t(G9, "Κλειστό: χρήστης δεν δηλώνει pet shop", false, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_shop"], exact: true, shop: true, ts: serverTimestamp() }));
await t(G9, "Κλειστό: οι υπάρχουσες υπηρεσίες (βόλτα σκύλου) δουλεύουν κανονικά", true, () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_walk"], ts: serverTimestamp() }));
await t(G9, "Ανοιχτό: χρήστης δηλώνει pet shop με σημείο καταστήματος", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_shop"], exact: true, shop: true, lat: 37.96234, lng: 23.75411, ts: serverTimestamp() }); });
await t(G9, "Κλειστό: εκδήλωση κατοικιδίων απορρίπτεται", false, () => eset("alice", "alice", "alice_e0", ev("alice", { world: "pets", kind: "adopt" })));
await t(G9, "Ανοιχτό: ημέρα υιοθεσίας για ενήλικες", true, async () => { await openPx(); return eset("alice", "alice", "alice_e0", ev("alice", { world: "pets", kind: "adopt" })); });
await t(G9, "Ανοιχτό: είδος εκδήλωσης άλλου κόσμου απορρίπτεται", false, async () => { await openPx(); return eset("alice", "alice", "alice_e0", ev("alice", { world: "pets", kind: "present" })); });
await t(G9, "Εκδήλωση χωρίς κόσμο απορρίπτεται", false, async () => { await openCul(); const d = ev("alice"); delete d.world; return eset("alice", "alice", "alice_e0", d); });
await t(G9, "Εκδήλωση σε άγνωστο κόσμο απορρίπτεται", false, async () => { await openPx(); return eset("alice", "alice", "alice_e0", ev("alice", { world: "tech", kind: "other" })); });
await t(G9, "Κλειστό: τρίτος δεν διαβάζει εγκεκριμένη εκδήλωση κατοικιδίων", false, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_events/alice_e0"), { ...ev("alice", { world: "pets", kind: "adopt", status: "ok" }), ts: now() })); return getDoc(doc(ctx.bob(), "kontamou_events/alice_e0")); });
await t(G9, "Ανοιχτό: τρίτος διαβάζει εγκεκριμένη εκδήλωση κατοικιδίων", true, async () => { await openPx(); await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_events/alice_e0"), { ...ev("alice", { world: "pets", kind: "adopt", status: "ok" }), ts: now() })); return getDoc(doc(ctx.bob(), "kontamou_events/alice_e0")); });
await t(G9, "1.44: αίτημα αφαίρεσης στη βάση δεν γίνεται πια (email / OpenStreetMap)", false, () => rset("alice", "alice", "alice_n12345", req("alice", "n12345")));
await t(G9, "1.44: ούτε για συνεργείο αυτοκινήτων", false, () => rset("alice", "alice", "alice_n777", req("alice", "n777", { world: "car", name: "Συνεργείο" })));
await t(G9, "1.44: ούτε για σιδηρικά", false, () => rset("alice", "alice", "alice_w888", req("alice", "w888", { world: "tech", name: "Σιδηρικά" })));
await t(G9, "1.43: αίτημα σε άγνωστο κόσμο απορρίπτεται", false, () => rset("alice", "alice", "alice_n999", req("alice", "n999", { world: "health" })));
await t(G9, "Αίτημα στο όνομα άλλου απορρίπτεται", false, () => rset("eve", "eve", "alice_n12345", req("alice", "n12345")));
await t(G9, "Αίτημα με λάθος κλειδί (σύμβολα) απορρίπτεται", false, () => rset("alice", "alice", "alice_n1-2", req("alice", "n1-2")));
await t(G9, "Αίτημα με άγνωστο είδος απορρίπτεται", false, () => rset("alice", "alice", "alice_n12345", req("alice", "n12345", { kind: "delete_all" })));
await t(G9, "Αίτημα χωρίς λόγο απορρίπτεται", false, () => rset("alice", "alice", "alice_n12345", req("alice", "n12345", { why: "" })));
await t(G9, "Τρίτος δεν διαβάζει ξένο αίτημα", false, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_osmreq/alice_n12345"), { ...req("alice", "n12345"), ts: now() })); return getDoc(doc(ctx.bob(), "kontamou_osmreq/alice_n12345")); });
await t(G9, "1.44: ο ίδιος δεν διαβάζει πια παλιό αίτημα του", false, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_osmreq/alice_n12345"), { ...req("alice", "n12345"), ts: now() })); return getDoc(doc(ctx.alice(), "kontamou_osmreq/alice_n12345")); });
await t(G9, "1.44: ο διαχειριστής σβήνει παλιό αίτημα", true, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_osmreq/alice_n12345"), { ...req("alice", "n12345"), ts: now() })); return deleteDoc(doc(ctx.owner(), "kontamou_osmreq/alice_n12345")); });
await t(G9, "Ο διαχειριστής διαβάζει τα αιτήματα", true, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_osmreq/alice_n12345"), { ...req("alice", "n12345"), ts: now() })); return getDocs(collection(ctx.co(), "kontamou_osmreq")); });
await t(G9, "Χρήστης δεν κρύβει σημεία (ρύθμιση osmhide)", false, () => setDoc(doc(ctx.alice(), "kontamou_config/osmhide"), { keys: ["n1"] }));
await t(G9, "Ο διαχειριστής κρύβει σημείο (ρύθμιση osmhide)", true, () => setDoc(doc(ctx.co(), "kontamou_config/osmhide"), { keys: ["n1"] }));

// ---------- G10: κόσμος «Εκδηλώσεις» — αναφορές λάθους (1.45) ----------
const G10 = "Εκδηλώσεις: αναφορές λάθους (1.45)";
const openEkd = () => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_config/worlds"), { open: ["home", "pets", "car", "learn", "ekd"] }));
const later = () => Timestamp.fromMillis(Date.now() + 10 * 864e5);
const erep = (uid, extra = {}) => ({ uid, ev: "pan-agiou-1", ep: "20261110", why: "cancelled", until: later(), ts: serverTimestamp(), ...extra });
// πλήρης αναφορά: ρυθμός + αναφορά + μετρητής (+1 στην αιτία)
const report = (who, uid, r, cnt, cid = "pan-agiou-1_20261110") => withRate(ctx[who](), uid, (b, db) => {
  b.set(doc(db, "kontamou_evrep/" + (r.ev + "_" + r.ep + "_" + uid)), r);
  if (cnt) b.set(doc(db, "kontamou_evcnt/" + cid), cnt, { merge: true }); });
const cntNow = async (cid = "pan-agiou-1_20261110") => { let v = null; await env.withSecurityRulesDisabled(async c => { const d = await getDoc(doc(c.firestore(), "kontamou_evcnt/" + cid)); v = d.exists() ? d.data() : null; }); return v; };
const until0 = later();
await t(G10, "Κλειστός κόσμος: χρήστης δεν κάνει αναφορά", false, () => report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }));
await t(G10, "Ανοιχτός: πρώτη αναφορά (μετρητής 1)", true, async () => { await openEkd(); return report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); });
await t(G10, "Δεύτερη αναφορά του ΙΔΙΟΥ χρήστη για την ίδια εκδήλωση απορρίπτεται", false, async () => { await openEkd();
  await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); await new Promise(r => setTimeout(r, 10500));
  const c = await cntNow(); return report("alice", "alice", erep("alice", { until: until0 }), { cancelled: (c.cancelled || 0) + 1 }); });
await t(G10, "Δεύτερος χρήστης με την ίδια αιτία (μετρητής 2)", true, async () => { await openEkd();
  await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return report("bob", "bob", erep("bob", { until: until0 }), { cancelled: 2 }); });
await t(G10, "Αύξηση μετρητή κατά 2 απορρίπτεται", false, async () => { await openEkd();
  await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return report("bob", "bob", erep("bob", { until: until0 }), { cancelled: 3 }); });
await t(G10, "Αύξηση μετρητή σε ΑΛΛΗ αιτία από αυτή της αναφοράς απορρίπτεται", false, async () => { await openEkd();
  await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return report("bob", "bob", erep("bob", { until: until0 }), { date: 1 }); });
await t(G10, "Αύξηση μετρητή χωρίς αναφορά απορρίπτεται", false, async () => { await openEkd();
  await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return setDoc(doc(ctx.eve(), "kontamou_evcnt/pan-agiou-1_20261110"), { cancelled: 2 }, { merge: true }); });
await t(G10, "Αναφορά χωρίς αύξηση μετρητή απορρίπτεται", false, async () => { await openEkd(); return report("alice", "alice", erep("alice"), null); });
await t(G10, "Αναφορά στο όνομα άλλου απορρίπτεται", false, async () => { await openEkd(); const r = erep("alice", { until: until0 });
  return withRate(ctx.eve(), "eve", (b, db) => { b.set(doc(db, "kontamou_evrep/pan-agiou-1_20261110_alice"), r); b.set(doc(db, "kontamou_evcnt/pan-agiou-1_20261110"), { cancelled: 1, until: until0 }); }); });
await t(G10, "Άγνωστη αιτία απορρίπτεται", false, async () => { await openEkd(); return report("alice", "alice", erep("alice", { why: "spam", until: until0 }), { spam: 1, until: until0 }); });
await t(G10, "Επιπλέον πεδίο (π.χ. email) απορρίπτεται", false, async () => { await openEkd(); return report("alice", "alice", erep("alice", { email: "a@b.gr", until: until0 }), { cancelled: 1, until: until0 }); });
await t(G10, "Λάθος κωδικός εκδήλωσης (σύμβολα) απορρίπτεται", false, async () => { await openEkd(); return report("alice", "alice", erep("alice", { ev: "pan/../x", until: until0 }), { cancelled: 1, until: until0 }, "pan-x_20261110"); });
await t(G10, "Χρήστης που έχασε το δικαίωμα δεν κάνει αναφορά (σιωπηλά)", false, async () => { await openEkd();
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_noreport/alice"), { at: now() })); return report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); });
await t(G10, "Αποκλεισμένος χρήστης δεν κάνει αναφορά", false, async () => { await openEkd();
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_bans/alice"), { at: now() })); return report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); });
await t(G10, "Ο καθένας διαβάζει τους μετρητές (μόνο αριθμοί)", true, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return getDoc(doc(ctx.anon(), "kontamou_evcnt/pan-agiou-1_20261110")); });
await t(G10, "Τρίτος δεν διαβάζει ξένη αναφορά", false, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return getDoc(doc(ctx.bob(), "kontamou_evrep/pan-agiou-1_20261110_alice")); });
await t(G10, "Ο ίδιος διαβάζει την αναφορά του", true, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return getDoc(doc(ctx.alice(), "kontamou_evrep/pan-agiou-1_20261110_alice")); });
await t(G10, "Ο ίδιος δεν σβήνει την αναφορά πριν περάσει η εκδήλωση", false, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return deleteDoc(doc(ctx.alice(), "kontamou_evrep/pan-agiou-1_20261110_alice")); });
await t(G10, "Ο ίδιος σβήνει την αναφορά αφού περάσει η εκδήλωση", true, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_evrep/pan-agiou-1_20261110_alice"), { ...rep("alice"), until: past(1), ts: now() })); return deleteDoc(doc(ctx.alice(), "kontamou_evrep/pan-agiou-1_20261110_alice")); });
await t(G10, "Ο διαχειριστής σβήνει αναφορές", true, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return deleteDoc(doc(ctx.co(), "kontamou_evrep/pan-agiou-1_20261110_alice")); });
await t(G10, "Τρίτος δεν σβήνει μετρητή πριν περάσει η εκδήλωση", false, async () => { await openEkd(); await report("alice", "alice", erep("alice", { until: until0 }), { cancelled: 1, until: until0 }); return deleteDoc(doc(ctx.eve(), "kontamou_evcnt/pan-agiou-1_20261110")); });
await t(G10, "Χρήστης δεν βλέπει τη λίστα «χωρίς δικαίωμα αναφοράς»", false, () => getDoc(doc(ctx.alice(), "kontamou_noreport/alice")));
await t(G10, "Χρήστης δεν βγάζει μόνος του τον εαυτό του από τη λίστα", false, async () => { await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "kontamou_noreport/alice"), { at: now() })); return deleteDoc(doc(ctx.alice(), "kontamou_noreport/alice")); });
await t(G10, "Ο διαχειριστής γράφει στη λίστα «χωρίς δικαίωμα αναφοράς»", true, () => setDoc(doc(ctx.co(), "kontamou_noreport/alice"), { at: now() }));
await t(G10, "Εκδήλωση κατοικιδίων συνεχίζει να δουλεύει", true, async () => { await openPx(); return eset("alice", "alice", "alice_e0", ev("alice", { world: "pets", kind: "adopt" })); });

const full = { hours: "09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|10:00-14:00|", animals: ["dog","cat","small","bird","fish"], modes: ["go","place","online"],
  freq: ["once","week","2week","month"], levels: ["uni","adult"], desc: "Περιγραφή ".repeat(50), price: "π.χ. 15 € / ώρα", regNo: "ΑΜ 1234 Κτηνιατρικός Σύλλογος", customName: "Όνομα καταστήματος",
  area: "Παγκράτι, Αθήνα", job: "Δουλειά", radius: 20, years: 15, supplies: true, offHol: true, offHide: false, availDay: "2026-11-05", hasPhone: true, hasEmail: true };

await t(G9, "Ανοιχτό: pet shop χωρίς σημείο καταστήματος", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_shop"], ts: serverTimestamp() }); });
await t(G9, "Βόλτα σκύλων με σημείο καταστήματος (υπάρχουσα λειτουργία)", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_walk"], exact: true, shop: true, lat: 37.96234, lng: 23.75411, ts: serverTimestamp() }); });
await t(G9, "Όριο αξιολόγησης: πλήρες προφίλ κτηνιατρείου (όλα τα πεδία, 3 ειδικότητες)", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_vet", "p_shop", "p_walk"], ...full, ts: serverTimestamp() }); });
await t(G9, "Όριο αξιολόγησης: πλήρες προφίλ κτηνιατρείου με σημείο καταστήματος", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "pets", trades: ["p_vet", "p_shop", "p_walk"], ...full, exact: true, shop: true, lat: 37.96234, lng: 23.75411, ts: serverTimestamp() }); });
await t(G9, "Όριο αξιολόγησης: πλήρες προφίλ τεχνικού (όλα τα πεδία)", true, async () => { await openPx(); return updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { world: "tech", trades: ["electric", "plumb", "other"], ...full, ts: serverTimestamp() }); });
await t(G9, "Όριο αξιολόγησης: πλήρες νέο προφίλ κτηνιατρείου (δημιουργία)", true, async () => { await openPx();
  return withRate(ctx.eve(), "eve", (b, db) => { b.set(doc(db, "kontamou_owner/eve"), { region: "attiki" }); b.set(doc(db, "kontamou_regions/attiki/profiles/eve"), { ...profile("eve", { world: "pets", trades: ["p_vet", "p_shop", "p_walk"], ...full, exact: true, shop: true, lat: 37.96234, lng: 23.75411 }), created: serverTimestamp(), ts: serverTimestamp() }); }); });

const upA = (o) => () => updateDoc(doc(ctx.alice(), "kontamou_regions/attiki/profiles/alice"), { ...o, ts: serverTimestamp() });
await t(G9, "Ωράριο: όλες οι μέρες με ώρες", true, upA({ hours: "09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|10:00-14:00|10:00-14:00", offHol: true, offHide: false }));
await t(G9, "Ωράριο: κακόβουλο κείμενο απορρίπτεται", false, upA({ hours: "<img src=x onerror=alert(1)>||||||" }));
await t(G9, "Ωράριο: παλιά μορφή (πίνακας) απορρίπτεται", false, upA({ hours: ["09:00-17:00","","","","","",""] }));
await t(G9, "Ωράριο: κλειστές μέρες (κενές) επιτρέπονται", true, upA({ hours: "09:00-17:00||||||" }));
await t(G9, "Ωράριο: λάθος αριθμός ημερών απορρίπτεται", false, upA({ hours: "09:00-17:00|09:00-17:00" }));
await t(G9, "Ωράριο: μη έγκυρη ώρα (25:00) απορρίπτεται", false, upA({ hours: "25:00-17:00||||||" }));
await t(G9, "Δεν αλλάζει μόνος του το ★ (featured)", false, upA({ featured: true }));
await t(G9, "Δεν δίνει μόνος του το ✓", false, upA({ verified: true }));
await t(G9, "Με ✓: αλλαγή ονόματος χωρίς να χάσει το ✓ απορρίπτεται", false, async () => { await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_regions/attiki/profiles/alice"), { verified: true })); return upA({ name: "Άλλο όνομα" })(); });
await t(G9, "Με ✓: αλλαγή ονόματος με απώλεια του ✓ επιτρέπεται", true, async () => { await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_regions/attiki/profiles/alice"), { verified: true })); return upA({ name: "Άλλο όνομα", verified: false })(); });
await t(G9, "Με ✓: αλλαγή περιγραφής κρατά το ✓", true, async () => { await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "kontamou_regions/attiki/profiles/alice"), { verified: true })); return upA({ desc: "Νέα περιγραφή" })(); });

// ---------- ΠΕΡΙΘΩΡΙΟ ΟΡΙΟΥ 1000 ΠΡΑΞΕΩΝ: ρεαλιστικά μέγιστα προφίλ ανά κόσμο, με τεχνητό «φορτίο» N πράξεων ----------
{
  const H = "09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|09:00-17:00|10:00-14:00|10:00-14:00";
  const base = { hours: H, offHol: true, offHide: false, modes: ["go","place","online"], price: "π".repeat(40), desc: "δ".repeat(600), customName: "κ".repeat(50),
    area: "α".repeat(80), job: "j".repeat(60), radius: 100, years: 70, availDay: "2026-11-05", hasPhone: true, hasEmail: true, fromDromologio: true };
  const P = {
    pets: { world: "pets", trades: ["p_vet", "p_shop", "p_salon"], animals: ["dog","cat","small","bird","fish"], regNo: "ρ".repeat(80) },
    home: { world: "home", trades: ["cleanpro", "h_iron", "h_other"], freq: ["once","week","2week","month"], supplies: true },
    learn: { world: "learn", trades: ["l_uni", "l_en", "l_other"], levels: ["uni","adult"] },
    tech: { world: "tech", trades: ["electric", "plumb", "other"] },
  };
  for (const N of [90]){                 // φύλακας: μέγιστα προφίλ περνούν ακόμα κι αν προστεθούν ~270 πράξεις στο μέλλον
    const pad = "    function pad() { return " + Array(N + 1).fill("1 == 1").join(" && ") + "; }\n";
    const R = RULES.replace("    function validProfile(rid, uid) {", pad + "    function validProfile(rid, uid) {")
      .replace("allow update: if isAdmin() || (signedIn() && me() == uid && validProfile(rid, uid) && petsxOk()", "allow update: if isAdmin() || (signedIn() && me() == uid && validProfile(rid, uid) && petsxOk() && pad()")
      .replace("allow create: if isAdmin() || (signedIn() && me() == uid && validProfile(rid, uid) && petsxOk()", "allow create: if isAdmin() || (signedIn() && me() == uid && validProfile(rid, uid) && petsxOk() && pad()");
    const E2 = await initializeTestEnvironment({ projectId: "demo-pad" + N, firestore: { rules: R, host: "127.0.0.1", port: 8080 } });
    for (const [w, extra] of Object.entries(P)){
      for (const ex of [false, true]){
        await E2.clearFirestore();
        await E2.withSecurityRulesDisabled(async c => { const db = c.firestore();
          await setDoc(doc(db, "kontamou_config/worlds"), { open: ["home", "pets", "car", "learn", "petsx", "culture"] });
          await setDoc(doc(db, "kontamou_owner/alice"), { region: "attiki" });
          await setDoc(doc(db, "kontamou_regions/attiki/profiles/alice"), profile("alice")); });
        const db = E2.authenticatedContext("alice", { email: "alice@example.com", email_verified: true }).firestore();
        const d = { ...base, ...extra, ...(ex ? { exact: true, shop: w !== "learn", lat: 37.96234, lng: 23.75411 } : {}), ts: serverTimestamp() };
        let ok = true, err = ""; try { await assertSucceeds(updateDoc(doc(db, "kontamou_regions/attiki/profiles/alice"), d)); } catch(e){ ok = false; err = String(e.message).slice(0, 80); }
        ok ? pass++ : fail++; out.push({ group: "Περιθώριο ορίου 1000 πράξεων", name: "μέγιστο προφίλ · " + w + (ex ? " · κατάστημα" : " · περιοχή") + " · +" + N + " πράξεις", expect: "ΕΠΙΤΡΕΠΕΤΑΙ", result: ok ? "ΣΩΣΤΟ" : "ΛΑΘΟΣ", err });
        console.log("ΠΕΡΙΘΩΡΙΟ", N, w, ex, ok);
      }
      // δημιουργία νέου προφίλ
      await E2.clearFirestore();
      await E2.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "kontamou_config/worlds"), { open: ["home", "pets", "car", "learn", "petsx", "culture"] }); });
      const db = E2.authenticatedContext("eve", { email: "eve@example.com", email_verified: true }).firestore();
      let ok = true, err = "";
      try { const b = writeBatch(db); b.set(doc(db, "kontamou_owner/eve"), { region: "attiki" });
        b.set(doc(db, "kontamou_regions/attiki/profiles/eve"), { ...profile("eve"), ...base, ...extra, created: serverTimestamp(), ts: serverTimestamp() }); await assertSucceeds(b.commit()); }
      catch(e){ ok = false; err = String(e.message).slice(0, 80); }
      console.log("ΠΕΡΙΘΩΡΙΟ", N, w, "δημιουργία", ok, err);
      ok ? pass++ : fail++; out.push({ group: "Περιθώριο ορίου 1000 πράξεων", name: "μέγιστο νέο προφίλ · " + w + " · +" + N + " πράξεις", expect: "ΕΠΙΤΡΕΠΕΤΑΙ", result: ok ? "ΣΩΣΤΟ" : "ΛΑΘΟΣ", err });
    }
    await E2.cleanup();
  }
}

await env.cleanup();
const md = ["# Αποτελέσματα δοκιμών κανόνων βάσης «Κοντά μου»", "", "Προσομοιωτής: Firebase Firestore Emulator · κανόνες: firestore.rules · ημερομηνία: " + new Date().toISOString(), "",
  `**Σύνολο: ${pass + fail} · σωστά: ${pass} · λάθος: ${fail}**`, "", "| # | Ομάδα | Δοκιμή | Αναμενόμενο | Αποτέλεσμα |", "|---|---|---|---|---|",
  ...out.map((r, i) => `| ${i + 1} | ${r.group} | ${r.name} | ${r.expect} | ${r.result === "ΣΩΣΤΟ" ? "✓ σωστό" : "✗ ΛΑΘΟΣ — " + r.err.replace(/\|/g, "/")} |`)];
writeFileSync("apotelesmata.md", md.join("\n") + "\n");
writeFileSync("apotelesmata.json", JSON.stringify({ pass, fail, out }, null, 1));
console.log(`\nΣΥΝΟΛΟ ${pass + fail} · ΣΩΣΤΑ ${pass} · ΛΑΘΟΣ ${fail}`);
process.exit(0);
