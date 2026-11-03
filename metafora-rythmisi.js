/* Κοντά μου — τι παίρνει ο παραλήπτης «Μεταφορά στοιχείων» (metafora-lipsi.js) από την παλιά διεύθυνση
   aglentzakis-dot.github.io/kontamou/ → kontamou.glenapps.gr.
   © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
   ls   : «kontamou.v1» (πινέζες της τοπικής λειτουργίας), όλα τα «km_…» (αγαπημένα, όροι, κόσμος, ειδοποιήσεις, αντίγραφα),
          το τελευταίο στιγμιότυπο από το Δρομολόγιο («kontamou_from_dromologio») και η κοινή γλώσσα («stodromo-lang»)
   idb  : καμία (τα στοιχεία λογαριασμού είναι στο διαδίκτυο· η σύνδεση Google γίνεται ξανά στη νέα διεύθυνση)
   opfs : κανένα
   exei : αν εδώ υπάρχουν ήδη πινέζες ή αγαπημένα (για την προειδοποίηση πριν από την αντικατάσταση). */
window.GLEN_METAFORA={app:"kontamou",onoma:"Κοντά μου",
  ls:["kontamou.v1","km_","kontamou_from_dromologio","stodromo-lang"],
  idb:[],
  opfs:[],
  exei:function(){try{var n=function(k){var v=localStorage.getItem(k);if(!v)return 0;var d=JSON.parse(v);return d&&typeof d==="object"?Object.keys(d).length:0};
    return n("kontamou.v1")>0||n("km_favs")>0}catch(e){return true}}};
