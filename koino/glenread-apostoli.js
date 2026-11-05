/* GlenApps → GlenRead: άνοιγμα συνδέσμου ή αρχείου στο GlenRead (π.χ. κουμπί «📖 Διάβασέ το» στο «Κοντά μου»).
   Αντιγράφεται ΑΥΤΟΥΣΙΟ μέσα σε κάθε εφαρμογή που το χρειάζεται (κανόνας αυτονομίας — όχι φόρτωση από το GlenRead).

   GlenReadApostoli.syndesmos("https://…/vivlio.epub","Κοντά μου")   → ανοίγει το GlenRead, που ΡΩΤΑ τον χρήστη πριν κατεβάσει
   GlenReadApostoli.arxeio(file,"Κοντά μου")                          → στέλνει ΕΝΑ αρχείο (File/Blob), το GlenRead ρωτά πριν το ανοίξει

   Κανόνες: μόνο https σύνδεσμοι· το αρχείο πηγαίνει κατευθείαν από παράθυρο σε παράθυρο, στη συσκευή — κανένας διακομιστής.
   Πριν το κουμπί δείξε ΙΣΟΤΙΜΑ: «Άνοιγμα στο GlenRead» και «Άνοιγμα στο πρόγραμμα περιήγησης» (καμία προτροπή «απαιτείται η εφαρμογή»). */
(function(){
  var GR="https://glenread.glenapps.gr";
  function syndesmos(url,apo){
    var u;try{u=new URL(url)}catch(e){return false}
    if(u.protocol!=="https:")return false;
    window.open(GR+"/?open="+encodeURIComponent(u.href)+(apo?"&apo="+encodeURIComponent(apo):""),"_blank","noopener");
    return true;
  }
  function arxeio(file,apo){
    if(!file||!(file instanceof Blob))return false;
    var w=window.open(GR+"/?dexou=1","_blank");if(!w)return false;
    var sent=false;
    function on(e){
      if(e.origin!==GR||e.source!==w||!e.data||e.data.glenread!=="etoimo"||sent)return;
      sent=true;window.removeEventListener("message",on);
      w.postMessage({glenread:"arxeio",name:file.name||"αρχείο",type:file.type||"",data:file,apo:apo||""},GR);
    }
    window.addEventListener("message",on);
    setTimeout(function(){window.removeEventListener("message",on)},60000);
    return true;
  }
  window.GlenReadApostoli={syndesmos:syndesmos,arxeio:arxeio};
})();
