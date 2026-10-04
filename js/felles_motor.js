/**
 * FELLES MOTOR & FORRETNINGSLOGIKK (Moneta 2026)
 * Datakilde: Forbruksforskningsinstituttet SIFO, OsloMet (Referansebudsjettet 2026, CC BY 4.0)
 * Inkluderer 3-lags budsjett, målsparing og livsfase-/stresstests-simulator.
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
    boliglanSaldo: 0,
    boliglanTermin: 0,
    felleskost: 0,
    strom: 0,
    forsikring: 0,
    helse: 0,
    restaurant: 0,
    ferie: 0,
    annenSparing: 0,
    faktiskForbruk: {},
    aktivtMaalId: "maal_1",
    sparemaalListe: [
      { id: "maal_1", tittel: "Påske 2027", malsum: 35000, mnd: 6, valgteTiltak: {}, aktiverteKutt: [] },
      { id: "maal_2", tittel: "Ferie", malsum: 20000, mnd: 6, valgteTiltak: {}, aktiverteKutt: [] }
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
    const bekreft = confirm("Er du sikker på at du vil slette alle lagrede data?\n\nDette nullstiller budsjettet, profilen og lagrede sparemål.");
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

  // 5. DYNAMISKE KUTTFORSLAG
  function genererKuttForslag(state) {
    const { normer } = beregnEksaktSifoNorm(state);
    const forslag = [];

    for (const kNr in SIFO_KLYNGER) {
      SIFO_KLYNGER[kNr].poster.forEach(post => {
        const faktisk = Number(state.faktiskForbruk[post.id]) || 0;
        const norm = Number(normer[post.id]) || 0;
        const diff = faktisk - norm;
        if (diff > 50) {
          forslag.push({
            id: `kutt_${post.id}`,
            postId: post.id,
            tittel: `Kutt ${post.navn} til SIFO-norm`,
            belop: Math.round(diff),
            type: 'sifo'
          });
        }
      });
    }

    const rest = Number(state.restaurant) || 0;
    if (rest > 0) {
      forslag.push({
        id: 'kutt_restaurant_50',
        felt: 'restaurant',
        tittel: 'Reduser Restaurant & Kafé med 50%',
        belop: Math.round(rest * 0.5),
        type: 'livsstil'
      });
    }

    const ferie = Number(state.ferie) || 0;
    if (ferie > 0) {
      forslag.push({
        id: 'kutt_ferie_50',
        felt: 'ferie',
        tittel: 'Reduser Ferieavsetning med 50%',
        belop: Math.round(ferie * 0.5),
        type: 'livsstil'
      });
    }

    return forslag;
  }

  // 6. TOTALBEREGNING NÅVÆRENDE BUDSJETT (BASELINE)
  function beregnTotalOkonomi(state) {
    const { normer, klynger, totalNorm } = beregnEksaktSifoNorm(state);

    if (!state.faktiskForbruk) state.faktiskForbruk = {};
    if (state.transportmiddel === 'Kollektivtransport') {
      state.faktiskForbruk.bilhold = 0;
    } else {
      state.faktiskForbruk.kollektivreise = 0;
    }

    const boliglanTermin = Number(state.boliglanTermin) || 0;
    const felleskost = Number(state.felleskost) || 0;
    const strom = Number(state.strom) || 0;
    const forsikring = Number(state.forsikring) || 0;
    const helse = Number(state.helse) || 0;
    const sumFaste = boliglanTermin + felleskost + strom + forsikring + helse;

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

    const maalListe = state.sparemaalListe || [];
    let sumMaalsparingMnd = 0;
    maalListe.forEach(m => {
      const mnd = Math.max(1, Number(m.mnd) || 1);
      const krav = Math.round(Number(m.malsum || 0) / mnd);
      sumMaalsparingMnd += krav;
    });

    const restaurant = Number(state.restaurant) || 0;
    const ferie = Number(state.ferie) || 0;
    const annenSparing = Number(state.annenSparing) || 0;
    const sumLivsstil = restaurant + ferie + annenSparing + sumMaalsparingMnd;

    const inntektNetto = Number(state.inntektNetto) || 0;
    const buffer = inntektNetto - sumFaste - sumForbrukFaktisk - sumLivsstil;

    const saldo = Number(state.boliglanSaldo) || 0;
    let renteTaleevne = 4.5;
    if (saldo > 0) {
      const aarligBuffer = Math.max(0, buffer) * 12;
      const taltOkning = (aarligBuffer / (saldo * 0.78)) * 100;
      renteTaleevne = Math.max(0, Math.round(taltOkning * 10) / 10);
    }

    const aktivtMaal = maalListe.find(m => m.id === state.aktivtMaalId) || maalListe[0] || {
      id: 'default', tittel: 'Sparemål', malsum: 30000, mnd: 6, valgteTiltak: {}, aktiverteKutt: []
    };
    const aktivtMalsum = Number(aktivtMaal.malsum) || 0;
    const aktivtMnd = Math.max(1, Number(aktivtMaal.mnd) || 1);
    const aktivtKrav = Math.round(aktivtMalsum / aktivtMnd);

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
      buffer,
      renteTaleevne,
      aktivtMaal: {
        id: aktivtMaal.id,
        tittel: aktivtMaal.tittel,
        malsum: aktivtMalsum,
        mnd: aktivtMnd,
        paakrevd: aktivtKrav
      }
    };
  }

  // 7. SIMULERINGSMOTOR: LIVSFASE & MAKRO-STRESSTEST
  function simulerScenario(state, config = {}) {
    const baseline = beregnTotalOkonomi(state);

    const simProfil = {
      voksne: Number(state.voksne) || 1,
      barn: Number(state.barn) || 0,
      inntektNetto: Number(state.inntektNetto) || 0,
      transportmiddel: state.transportmiddel || 'Bensinbil',
      boliglanSaldo: Number(state.boliglanSaldo) || 0,
      boliglanTermin: Number(state.boliglanTermin) || 0,
      felleskost: Number(state.felleskost) || 0,
      strom: Number(state.strom) || 0,
      forsikring: Number(state.forsikring) || 0,
      helse: Number(state.helse) || 0,
      restaurant: Number(state.restaurant) || 0,
      ferie: Number(state.ferie) || 0,
      annenSparing: Number(state.annenSparing) || 0,
      sparemaalListe: state.sparemaalListe || []
    };

    // Hjelpefunksjon: annuitetsberegning for lån
    function regnUtTermin(lanebelop, rentePst, ar) {
      const mndRente = (rentePst / 100) / 12;
      const terminer = ar * 12;
      if (mndRente > 0) {
        return Math.round(lanebelop * (mndRente * Math.pow(1 + mndRente, terminer)) / (Math.pow(1 + mndRente, terminer) - 1));
      }
      return Math.round(lanebelop / terminer);
    }

    // A. APPLISER LIVSFASE
    const scenario = config.scenarioType || 'uendret';

    if (scenario === 'kjope_bolig') {
      const nyttLan = Number(config.kjopeBolig?.lanebelop) || 3000000;
      const rente = Number(config.kjopeBolig?.rente) || 5.0;
      const ar = Number(config.kjopeBolig?.lopetidAr) || 25;
      const nyFelles = Number(config.kjopeBolig?.felleskost) || 3500;

      simProfil.boliglanSaldo = nyttLan;
      simProfil.boliglanTermin = regnUtTermin(nyttLan, rente, ar);
      simProfil.felleskost = nyFelles;

    } else if (scenario === 'bli_samboer') {
      simProfil.voksne = Math.max(2, simProfil.voksne + 1);
      const partnerInntekt = Number(config.partnerInntekt) || 35000;
      simProfil.inntektNetto += partnerInntekt;

      if (config.partnerLanTermin) {
        simProfil.boliglanTermin += Number(config.partnerLanTermin);
      }

      // Kjøpe bolig sammen som samboere
      if (config.partnerKjopeBolig && config.samboerBolig) {
        const lan = Number(config.samboerBolig.lanebelop) || 4500000;
        const rente = Number(config.samboerBolig.rente) || 5.0;
        const ar = Number(config.samboerBolig.lopetidAr) || 25;
        const felles = Number(config.samboerBolig.felleskost) || 4500;

        simProfil.boliglanSaldo = lan;
        simProfil.boliglanTermin = regnUtTermin(lan, rente, ar);
        simProfil.felleskost = felles;
      }

      if (config.antallNyeBarn) {
        simProfil.barn += Number(config.antallNyeBarn);
      }

    } else if (scenario === 'fa_barn' || scenario === 'flere_barn') {
      const ekstra = Math.max(1, Number(config.antallNyeBarn) || 1);
      simProfil.barn += ekstra;

    } else if (scenario === 'samlivsbrudd') {
      simProfil.voksne = 1;
      if (config.samlivsbrudd?.egenInntektNetto) {
        simProfil.inntektNetto = Number(config.samlivsbrudd.egenInntektNetto);
      } else {
        simProfil.inntektNetto = Math.round(simProfil.inntektNetto * 0.5);
      }

      const fordeling = config.samlivsbrudd?.barnefordeling || 'delt_50_50';
      if (fordeling === 'delt_50_50') {
        simProfil.barn = Math.max(0, simProfil.barn * 0.5);
      }

      const boligValg = config.samlivsbrudd?.boligValg || 'beholde_alene';
      if (boligValg === 'beholde_alene') {
        // Må bære nåværende lån alene
      } else if (boligValg === 'kjope_mindre') {
        const nyTermin = Number(config.samlivsbrudd?.nyMndKostnad) || Math.round(simProfil.boliglanTermin * 0.65);
        simProfil.boliglanTermin = nyTermin;
        simProfil.boliglanSaldo = Math.round(simProfil.boliglanSaldo * 0.6);
        simProfil.felleskost = Math.round(simProfil.felleskost * 0.7);
      } else if (boligValg === 'leie') {
        const nyHusleie = Number(config.samlivsbrudd?.nyMndKostnad) || 14000;
        simProfil.boliglanTermin = 0;
        simProfil.boliglanSaldo = 0;
        simProfil.felleskost = nyHusleie;
      }
    }

    // B. APPLISER MAKRO & STRESSTESTER
    const renteOkningPst = Number(config.renteOkningPst) || 0;
    if (renteOkningPst > 0 && simProfil.boliglanSaldo > 0) {
      const aarligRenteMer = simProfil.boliglanSaldo * (renteOkningPst / 100);
      const nettoMndMerrente = (aarligRenteMer * 0.78) / 12; // 22% rentefradrag
      simProfil.boliglanTermin += Math.round(nettoMndMerrente);
    }

    const dyrtidPst = Number(config.dyrtidPst) || 0;
    const dyrtidFaktor = 1 + (dyrtidPst / 100);

    const inntektsfallPst = Number(config.inntektsfallPst) || 0;
    if (inntektsfallPst > 0) {
      simProfil.inntektNetto = Math.round(simProfil.inntektNetto * (1 - (inntektsfallPst / 100)));
    }

    // C. BEREGN SIFO FOR DET SIMULERTE SCENARIOET
    const sifoBeregning = beregnEksaktSifoNorm(simProfil);
    let simSumSifo = sifoBeregning.totalNorm * dyrtidFaktor;
    const simStrom = Math.round(simProfil.strom * dyrtidFaktor);

    // D. FASTE KOSTNADER (LAG 1)
    const simSumFaste = simProfil.boliglanTermin + simProfil.felleskost + simStrom + simProfil.forsikring + simProfil.helse;

    // E. LIVSSTIL & SPARING (LAG 3)
    let simSumMaalsparing = 0;
    simProfil.sparemaalListe.forEach(m => {
      const mnd = Math.max(1, Number(m.mnd) || 1);
      simSumMaalsparing += Math.round(Number(m.malsum || 0) / mnd);
    });
    const simSumLivsstil = simProfil.restaurant + simProfil.ferie + simProfil.annenSparing + simSumMaalsparing;

    // F. TOTAL BUFFER I SIMULERINGEN
    const simBuffer = Math.round(simProfil.inntektNetto - simSumFaste - simSumSifo - simSumLivsstil);

    // G. DELTA (FØR VS ETTER)
    const deltaBuffer = simBuffer - baseline.buffer;
    const deltaInntekt = simProfil.inntektNetto - baseline.inntektNetto;
    const deltaFaste = simSumFaste - baseline.sumFaste;
    const deltaSifo = Math.round(simSumSifo - baseline.sumSifoNorm);

    let status = 'robust';
    let statusTekst = 'Økonomien er robust og tåler endringen godt.';
    if (simBuffer < 0) {
      status = 'kritisk';
      statusTekst = `Underskudd: Månedlig gap på ${fmt(Math.abs(simBuffer))} kr/mnd.`;
    } else if (simBuffer < 4000) {
      status = 'saarbar';
      statusTekst = 'Stram økonomi: Liten buffer mot uforutsette hendelser.';
    }

    // H. TILTAK VED UNDERSKUDD
    const nodvendigeKutt = [];
    if (simBuffer < 0) {
      const underskudd = Math.abs(simBuffer);
      let dekketHittil = 0;

      if (simProfil.restaurant > 0) {
        const kuttRest = Math.min(underskudd - dekketHittil, simProfil.restaurant);
        nodvendigeKutt.push({ tittel: 'Kutt i Restaurant & Kafé', belop: kuttRest });
        dekketHittil += kuttRest;
      }
      if (dekketHittil < underskudd && simProfil.ferie > 0) {
        const kuttFerie = Math.min(underskudd - dekketHittil, simProfil.ferie);
        nodvendigeKutt.push({ tittel: 'Kutt i Ferieavsetning', belop: kuttFerie });
        dekketHittil += kuttFerie;
      }
      if (dekketHittil < underskudd && simSumMaalsparing > 0) {
        const pauseMaal = Math.min(underskudd - dekketHittil, simSumMaalsparing);
        nodvendigeKutt.push({ tittel: 'Pause eller forlenge sparemål', belop: pauseMaal });
        dekketHittil += pauseMaal;
      }
    }

    return {
      baseline: {
        buffer: baseline.buffer,
        inntekt: baseline.inntektNetto,
        faste: baseline.sumFaste,
        sifo: baseline.sumSifoNorm,
        livsstil: baseline.sumLivsstil,
        renteTaleevne: baseline.renteTaleevne
      },
      simulert: {
        voksne: simProfil.voksne,
        barn: simProfil.barn,
        buffer: simBuffer,
        inntekt: simProfil.inntektNetto,
        faste: simSumFaste,
        sifo: Math.round(simSumSifo),
        livsstil: simSumLivsstil,
        boliglanTermin: simProfil.boliglanTermin,
        boliglanSaldo: simProfil.boliglanSaldo
      },
      delta: {
        buffer: deltaBuffer,
        inntekt: deltaInntekt,
        faste: deltaFaste,
        sifo: deltaSifo
      },
      vurdering: {
        status,
        statusTekst,
        nodvendigeKutt
      }
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
    simulerScenario,
    fmt
  };
})();