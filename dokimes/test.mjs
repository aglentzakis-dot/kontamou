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

await env.cleanup();
const md = ["# Αποτελέσματα δοκιμών κανόνων βάσης «Κοντά μου»", "", "Προσομοιωτής: Firebase Firestore Emulator · κανόνες: firestore.rules · ημερομηνία: " + new Date().toISOString(), "",
  `**Σύνολο: ${pass + fail} · σωστά: ${pass} · λάθος: ${fail}**`, "", "| # | Ομάδα | Δοκιμή | Αναμενόμενο | Αποτέλεσμα |", "|---|---|---|---|---|",
  ...out.map((r, i) => `| ${i + 1} | ${r.group} | ${r.name} | ${r.expect} | ${r.result === "ΣΩΣΤΟ" ? "✓ σωστό" : "✗ ΛΑΘΟΣ — " + r.err.replace(/\|/g, "/")} |`)];
writeFileSync("apotelesmata.md", md.join("\n") + "\n");
writeFileSync("apotelesmata.json", JSON.stringify({ pass, fail, out }, null, 1));
console.log(`\nΣΥΝΟΛΟ ${pass + fail} · ΣΩΣΤΑ ${pass} · ΛΑΘΟΣ ${fail}`);
process.exit(0);
