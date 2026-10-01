/**
 * SIFO REFERANSEBUDSJETT 2026 (OsloMet)
 * Kilde: Forbruksforskningsinstituttet SIFO, OsloMet (Referansebudsjettet_2026_Norsk.xlsx)
 * Lisens: Creative Commons Navngivelse 4.0 Internasjonal (CC BY 4.0)
 * Bearbeidet: Strukturert og aggregert inn i 4 forbruksklynger for Moneta.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    root.SIFO_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // 1. Individspesifikke satser 2026 (Kroner per måned)
  const INDIVID = {
    // Mat og drikke 2026 (Nye kostholdsråd)
    mat_drikke: {
      "0-5 mnd": 1065,
      "6-11 mnd": 2500,
      "1-3 ar": 2180,
      "4-6 ar": 2585,
      "7-10 ar": 3190,
      "jente_11-14": 3750,
      "gutt_11-14": 3840,
      "jente_15-17": 4120,
      "gutt_15-17": 4640,
      "kvinne_18-24": 4445,
      "kvinne_25-50": 4280,
      "kvinne_51-70": 3900,
      "kvinne_70+": 3915,
      "mann_18-24": 4945,
      "mann_25-50": 4760,
      "mann_51-70": 4355,
      "mann_70+": 4290,
      "gravide": 4895,
      "ammende": 5950,
      // Snittverdier benyttet ved forenklet husstandsprofil
      snitt_voksen: 4520,
      snitt_barn: 3160
    },

    // Klær og sko 2026
    klaer_sko: {
      under_1_ar: 730,
      "1_ar": 1140,
      "2-5_ar": 900,
      "6-9_ar": 1010,
      "jente_10-13": 880,
      "gutt_10-13": 860,
      "jente_14-17": 1030,
      "gutt_14-17": 1010,
      "kvinne_voksen": 1090,
      "mann_voksen": 1120,
      snitt_voksen: 1100,
      snitt_barn: 950
    },

    // Personlig pleie 2026
    personlig_pleie: {
      under_1_ar: 530,
      "1-2_ar": 630,
      "3_ar": 370,
      "4-5_ar": 240,
      "6-9_ar": 270,
      "jente_10-13": 520,
      "gutt_10-13": 380,
      "jente_14-17": 630,
      "gutt_14-17": 510,
      "kvinne_18-50": 1020,
      "mann_voksen": 820,
      "kvinne_50+": 980,
      snitt_voksen: 920,
      snitt_barn: 380
    },

    // Lek og mediebruk 2026 (Individuell andel)
    lek_mediebruk: {
      under_1_ar: 160,
      "1-2_ar": 390,
      "3-5_ar": 810,
      "6-9_ar": 1260,
      "10-13_ar": 1570,
      "14-17_ar": 1690,
      voksen: 1080
    },

    // Reisekostnader kollektiv (30-dagersbillett Ruter, Oslo pr. februar 2026)
    kollektiv: {
      barn_ungdom_6_19: 338,
      voksen_20_66: 1019,
      honnor_over_66: 510,
      student_20_29: 612
    },

    // Spedbarnsutstyr 2026
    spedbarnsutstyr: {
      grunnutrustning_fra_6mnd_for_fodsel: 3980,
      supplering_under_1_ar: 535
    }
  };

  // 2. Husholdningsspesifikke satser 2026 (Fordelt på antall personer 1–7)
  const HUSHOLDNING = {
    // Andre dagligvarer (såpe, papir, rengjøring m.m.)
    andre_dagligvarer: {
      1: 400, 2: 450, 3: 630, 4: 760, 5: 940, 6: 1050, 7: 1120
    },

    // Husholdningsartikler (kjøkkenutstyr, husholdningsmaskiner, sengetøy m.m.)
    husholdningsartikler: {
      1: 590, 2: 640, 3: 725, 4: 920, 5: 995, 6: 1075, 7: 1145
    },

    // Møbler og innbo
    mobler: {
      1: 550, 2: 680, 3: 870, 4: 990, 5: 1210, 6: 1430, 7: 1630
    },

    // Mediebruk og fritid (felles husholdningsandel)
    mediebruk_fritid: {
      1: 2570, 2: 2620, 3: 2760, 4: 2850, 5: 2880, 6: 2910, 7: 2910
    },

    // Bilkostnader (drift og vedlikehold, ekskl. avskrivning/lån)
    bilhold: {
      bensinbil: { pers_1_4: 3375, pers_5_7: 5105 },
      elbil: { pers_1_4: 2245, pers_5_7: 3085 }
    },

    // Barnehage (heltidsplass Oslo kommune pr. feb. 2026, ordinær takst)
    barnehage: {
      forste_barn: 1200,
      andre_barn_moderasjon: 840,
      ovrige_barn: 0
    },

    // Aktivitetsskolen AKS / SFO (heltidsplass Oslo kommune pr. feb. 2026)
    aks_heltid: 3834
  };

  // 3. Monetas 4 Forbruksklynger (inkl. Bilhold og Kollektivreiser som motposter)
  const KLYNGER = {
    1: {
      id: "klynge_1",
      tittel: "1. Mat & Dagligvarer",
      beskrivelse: "Mat, drikke og forbruksvarer i dagligvare",
      poster: [
        { id: "mat_drikke", navn: "Mat og drikke" },
        { id: "andre_dagligvarer", navn: "Andre dagligvarer" }
      ]
    },
    2: {
      id: "klynge_2",
      tittel: "2. Transport & Bilhold",
      beskrivelse: "Drift og vedlikehold av bil eller offentlig transport",
      poster: [
        { id: "bilhold", navn: "Bilkostnader (drift & vedlikehold)" },
        { id: "kollektivreise", navn: "Kollektivreiser (månedskort)" }
      ]
    },
    3: {
      id: "klynge_3",
      tittel: "3. Barn, SFO & Fritid",
      beskrivelse: "Lek, mediebruk, fritid og offentlige passordninger",
      poster: [
        { id: "lek_mediebruk", navn: "Lek & mediebruk" },
        { id: "barnehage_sfo", navn: "Barnehage & SFO" }
      ]
    },
    4: {
      id: "klynge_4",
      tittel: "4. Klær, Pleie & Hushold",
      beskrivelse: "Klær, sko, personlig pleie og møbler/husholdningsartikler",
      poster: [
        { id: "klaer_sko", navn: "Klær og sko" },
        { id: "personlig_pleie", navn: "Personlig pleie" },
        { id: "mobler_fritid", navn: "Møbler & fritid" }
      ]
    }
  };

  return {
    kilde: "SIFO / OsloMet – Referansebudsjettet 2026",
    lisens: "Creative Commons Navngivelse 4.0 Internasjonal (CC BY 4.0)",
    INDIVID,
    HUSHOLDNING,
    KLYNGER
  };
});