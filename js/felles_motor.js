/**
 * FELLES MOTOR & FORRETNINGSLOGIKK (Moneta 2026)
 * Datakilde: Forbruksforskningsinstituttet SIFO, OsloMet (Referansebudsjettet 2026, CC BY 4.0)
 * Lokal lagring uten eksterne biblioteksavhengigheter.
 */

(function () {
  const STORAGE_KEY = 'moneta_felles_state';

  // 1. DE 4 SIFO-KLYNGENE
  const SIFO_KLYNGER = {
    1: {
      id: "klynge_1",
      tittel: "1. Mat & Dagligvarer",
      poster: [
        { id: "mat_drikke", navn: "Mat og drikke" },
        { id: "andre_dagligvarer", navn: "Andre dagligvarer" }
      ]
    },
    2: {
      id: "klynge_2",
      tittel: "2. Transport & Bilhold",
      poster: [
        { id: "bilhold", navn: "Bilkostnader (drift & vedlikehold)" },
        { id: "kollektivreise", navn: "Kollektivreiser (månedskort)" }
      ]
    },
    3: {
      id: "klynge_3",
      tittel: "3. Barn, SFO & Fritid",
      poster: [
        { id: "lek_mediebruk", navn: "Lek & mediebruk" },
        { id: "barnehage_sfo", navn: "Barnehage & SFO" }
      ]
    },
    4: {
      id: "klynge_4",
      tittel: "4. Klær, Pleie & Hushold",
      poster: [
        { id: "klaer_sko", navn: "Klær og sko" },
        { id: "personlig_pleie", navn: "Personlig pleie" },
        { id: "mobler_fritid", navn: "Møbler & fritid" }
      ]
    }
  };

  // 2. STANDARD STARTTILSTAND
  const tomProfilState = {
    forstegangsBruker: true,
    fulltNavn: "",
    inntektNetto: 0,
    voksne: 1,
    barn: 0,
    transportmiddel: "Bensinbil", // 'Bensinbil', 'Elbil' eller 'Kollektivtransport'
    // Lag 1: Faste forpliktelser og bolig
    boliglanSaldo: 0,
    boliglanTermin: 0,
    felleskost: 0,
    strom: 0,
    forsikring: 0,
    helse: 0,
    // Lag 3: Livsstil & Sparing
    restaurant: 0,
    ferie: 0,
    annenSparing: 0,
    faktiskForbruk: {},
    aktivtMaalId: "maal_1",
    sparemaalListe: [
      { id: "maal_1", tittel: "Påske 2027", malsum: 35000, mnd: 6, valgteTiltak: {} },
      { id: "maal_2", tittel: "Ferie", malsum: 20000, mnd: 6, valgteTiltak: {} }
    ]
  };

  // 3. PERSISTENS (localStorage)
  function hentState() {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (!lagret) return JSON.parse(JSON.stringify(tomProfilState));
    try {
      return JSON.parse(lagret);
    } catch (e) {
      return JSON.parse(JSON.stringify(tomProfilState));
    }
  }

  function lagreState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Kunne ikke lagre til localStorage:", e);
    }
  }

  function nullstillAltOgSlettData() {
    const bekreft = confirm(
      "Er du sikker på at du vil slette alle lagrede data?\n\nDette nullstiller budsjettet, profilen og tar deg tilbake til registrering."
    );
    if (bekreft) {
      localStorage.removeItem(STORAGE_KEY);
      alert("Alle lokale data er slettet!");
      window.location.href = "index.html";
    }
  }

  // 4. SIFO 2026 NORMBEREGNING
  function beregnEksaktSifoNorm(profil) {
    const v = Math.max(1, Number(profil.voksne) || 1);
    const b = Math.max(0, Number(profil.barn) || 0);
    const pers = Math.min(7, Math.max(1, v + b));

    let bilNorm = 0;
    let kollektivNorm = 0;

    if (profil.transportmiddel === 'Bensinbil') {
      bilNorm = pers <= 4 ? 3375 : 5105;
      kollektivNorm = 0;
    } else if (profil.transportmiddel === 'Elbil') {
      bilNorm = pers <= 4 ? 2245 : 3085;
      kollektivNorm = 0;
    } else {
      bilNorm = 0;
      kollektivNorm = (v * 1019) + (b * 338);
    }

    const normer = {
      mat_drikke: (v * 4520) + (b * 3160),
      andre_dagligvarer: { 1: 400, 2: 450, 3: 630, 4: 760, 5: 940, 6: 1050, 7: 1120 }[pers] || 760,
      bilhold: bilNorm,
      kollektivreise: kollektivNorm,
      lek_mediebruk: (v * 1080) + (b * 1260),
      barnehage_sfo: b > 0 ? (b === 1 ? 1200 : 2040) : 0,
      klaer_sko: (v * 1100) + (b * 950),
      personlig_pleie: (v * 920) + (b * 380),
      mobler_fritid: ({ 1: 550, 2: 680, 3: 870, 4: 990, 5: 1210, 6: 1430, 7: 1630 }[pers] || 990)
                   + ({ 1: 590, 2: 640, 3: 725, 4: 920, 5: 995, 6: 1075, 7: 1145 }[pers] || 920)
    };

    const klynger = {};
    for (const kNr in SIFO_KLYNGER) {
      let sumNorm = 0;
      SIFO_KLYNGER[kNr].poster.forEach(post => {
        sumNorm += normer[post.id] || 0;
      });
      klynger[kNr] = sumNorm;
    }

    const totalNorm = Object.values(normer).reduce((a, b) => a + b, 0);
    return { normer, klynger, totalNorm };
  }

  function initFaktiskLikNorm(state) {
    const { normer } = beregnEksaktSifoNorm(state);
    state.faktiskForbruk = Object.assign({}, normer);

    if (state.transportmiddel === 'Kollektivtransport') {
      state.faktiskForbruk.bilhold = 0;
    } else {
      state.faktiskForbruk.kollektivreise = 0;
    }

    state.forstegangsBruker = false;
    lagreState(state);
    return state;
  }

  // 5. GENERER DYNAMISKE KUTTFORSLAG
  function genererKuttForslag(state) {
    const { normer } = beregnEksaktSifoNorm(state);
    const forslag = [];

    // Enkeltposter over norm
    for (const kNr in SIFO_KLYNGER) {
      SIFO_KLYNGER[kNr].poster.forEach(post => {
        const faktisk = Number(state.faktiskForbruk[post.id]) || 0;
        const norm = Number(normer[post.id]) || 0;
        const diff = faktisk - norm;
        if (diff > 50) {
          forslag.push({
            id: `kutt_${post.id}`,
            tittel: `Kutt ${post.navn} til SIFO-norm`,
            belop: Math.round(diff),
            type: 'sifo'
          });
        }
      });
    }

    // 50 % kutt på Restaurant & kafé
    const rest = Number(state.restaurant) || 0;
    if (rest > 0) {
      forslag.push({
        id: 'kutt_restaurant_50',
        tittel: 'Reduser Restaurant & Kafé med 50%',
        belop: Math.round(rest * 0.5),
        type: 'livsstil'
      });
    }

    // 50 % kutt på Ferieavsetning
    const ferie = Number(state.ferie) || 0;
    if (ferie > 0) {
      forslag.push({
        id: 'kutt_ferie_50',
        tittel: 'Reduser Ferieavsetning med 50%',
        belop: Math.round(ferie * 0.5),
        type: 'livsstil'
      });
    }

    return forslag;
  }

  // 6. TOTALBEREGNING (MED SPAREMÅL INN I LAG 3)
  function beregnTotalOkonomi(state) {
    const { normer, klynger, totalNorm } = beregnEksaktSifoNorm(state);

    if (!state.faktiskForbruk) state.faktiskForbruk = {};
    if (state.transportmiddel === 'Kollektivtransport') {
      state.faktiskForbruk.bilhold = 0;
    } else {
      state.faktiskForbruk.kollektivreise = 0;
    }

    // Lag 1: Faste forpliktelser
    const boliglanTermin = Number(state.boliglanTermin) || 0;
    const felleskost = Number(state.felleskost) || 0;
    const strom = Number(state.strom) || 0;
    const forsikring = Number(state.forsikring) || 0;
    const helse = Number(state.helse) || 0;
    const sumFaste = boliglanTermin + felleskost + strom + forsikring + helse;

    // Lag 2: Hverdagsforbruk
    const forbruk = state.faktiskForbruk || {};
    let sumForbrukFaktisk = 0;
    const klyngeFaktisk = {};
    const klyngeAvvik = {};
    let muligKutt = 0;

    for (const kNr in SIFO_KLYNGER) {
      let kSum = 0;
      SIFO_KLYNGER[kNr].poster.forEach(p => {
        kSum += (Number(forbruk[p.id]) || 0);
      });
      klyngeFaktisk[kNr] = kSum;
      const diff = kSum - klynger[kNr];
      klyngeAvvik[kNr] = diff;
      if (diff > 0) muligKutt += diff;
      sumForbrukFaktisk += kSum;
    }

    // Lag 3: Sparemål integreres som fast sparing
    const maalListe = state.sparemaalListe || [];
    let sumMaalsparingMnd = 0;
    let samletFrigjortFraKutt = 0;
    const forslag = genererKuttForslag(state);

    maalListe.forEach(m => {
      const mnd = Math.max(1, Number(m.mnd) || 1);
      const krav = Math.round(Number(m.malsum || 0) / mnd);
      sumMaalsparingMnd += krav;

      const valgte = m.valgteTiltak || {};
      forslag.forEach(f => {
        if (valgte[f.id]) samletFrigjortFraKutt += f.belop;
      });
    });

    const restaurant = Number(state.restaurant) || 0;
    const ferie = Number(state.ferie) || 0;
    const annenSparing = Number(state.annenSparing) || 0;
    const sumLivsstil = restaurant + ferie + annenSparing + sumMaalsparingMnd;

    // Disponibel restbuffer
    const inntektNetto = Number(state.inntektNetto) || 0;
    const buffer = inntektNetto - sumFaste - sumForbrukFaktisk - sumLivsstil + samletFrigjortFraKutt;

    // Rente-tåleevne
    const saldo = Number(state.boliglanSaldo) || 0;
    let renteTaleevne = 4.5;
    if (saldo > 0) {
      const aarligBuffer = Math.max(0, buffer) * 12;
      const taltOkning = (aarligBuffer / (saldo * 0.78)) * 100;
      renteTaleevne = Math.max(0, Math.round(taltOkning * 10) / 10);
    }

    // Aktivt valgt mål
    const aktivtMaal = maalListe.find(m => m.id === state.aktivtMaalId) || maalListe[0] || {
      id: 'default', tittel: 'Sparemål', malsum: 30000, mnd: 6, valgteTiltak: {}
    };

    const aktivtMalsum = Number(aktivtMaal.malsum) || 0;
    const aktivtMnd = Math.max(1, Number(aktivtMaal.mnd) || 1);
    const aktivtKrav = Math.round(aktivtMalsum / aktivtMnd);

    // Fremskrivning for aktivt mål
    const fremskrivning = { labels: [], dataUtenKutt: [], dataMedKutt: [] };
    const renKapasitetUtenKutt = Math.max(0, buffer - samletFrigjortFraKutt + aktivtKrav);
    for (let m = 0; m <= aktivtMnd; m++) {
      fremskrivning.labels.push(m === 0 ? '0' : `Mnd ${m}`);
      fremskrivning.dataUtenKutt.push(Math.min(aktivtMalsum, Math.round(renKapasitetUtenKutt * m)));
      fremskrivning.dataMedKutt.push(Math.min(aktivtMalsum, Math.round((renKapasitetUtenKutt + samletFrigjortFraKutt) * m)));
    }

    return {
      inntektNetto,
      sumFaste,
      boliglanSaldo: saldo,
      boliglanTermin,
      felleskost,
      strom,
      forsikring,
      helse,
      sumForbrukFaktisk,
      sumSifoNorm: totalNorm,
      sifoDifferanse: sumForbrukFaktisk - totalNorm,
      muligKutt,
      klyngeFaktisk,
      klyngeNorm: klynger,
      klyngeAvvik,
      normer,
      sumLivsstil,
      restaurant,
      ferie,
      annenSparing,
      sumMaalsparingMnd,
      samletFrigjortFraKutt,
      buffer,
      renteTaleevne,
      aktivtMaal: {
        id: aktivtMaal.id,
        tittel: aktivtMaal.tittel,
        malsum: aktivtMalsum,
        mnd: aktivtMnd,
        paakrevd: aktivtKrav
      },
      fremskrivning
    };
  }

  function fmt(tall) {
    return Math.round(tall || 0).toLocaleString('no-NO');
  }

  window.MonetaMotor = {
    SIFO_KLYNGER,
    hentState,
    lagreState,
    nullstillAltOgSlettData,
    beregnEksaktSifoNorm,
    initFaktiskLikNorm,
    genererKuttForslag,
    beregnTotalOkonomi,
    fmt
  };
})();