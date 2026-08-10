/**
 * Every visible string on the page, in both languages.
 *
 * `id` is typed against `en`, so a missing or misspelled key is a compile
 * error rather than a blank space on the page.
 *
 * The Indonesian is written, not translated. A treasurer says "nalangin", not
 * "menalangi terlebih dahulu", and "nggak enak" is the actual feeling the PRD
 * describes when it talks about the awkwardness of chasing friends. Technical
 * terms that Indonesians in this space already use in English (on-chain,
 * stablecoin, testnet, wallet, memo, ledger) are left alone.
 */

/** A body string with inline monospace runs: plain text, or a ledger value. */
export type Segment = string | { n: string };

const en = {
  meta: {
    title: "Splitr: who owes what, and proof they've paid",
    description:
      'Splitr turns a messy group bill into one settled ledger. Split in seconds, chase no one, and let the Stellar ledger, not a screenshot, say who is square.',
  },

  nav: {
    how: 'How it works',
    proof: 'Under the hood',
    faq: 'FAQ',
    app: 'App',
  },

  a11y: {
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
    language: 'Language',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },

  wallet: {
    connect: 'Connect wallet',
    connecting: 'Connecting…',
    disconnect: 'Disconnect',
    connected: 'Connected',
    // Said once, near the button, because it is the question people actually
    // have before clicking it.
    custody: 'Splitr never sees your secret key. You sign in your own wallet.',
    failed: 'Could not connect',
  },

  app: {
    title: 'Your bills',
    lede: 'Real bills on the deployed contract. The contract computes every share and moves the money in the same call that records it — nothing here is a mock.',
    connectFirst: 'Connect a wallet to see the bills you are on.',
    newBill: 'New bill',
    group: 'What was it',
    total: 'Total',
    members: 'Everyone who was in on it',
    membersHint: 'Stellar addresses, separated by commas. You are added automatically as the payer.',
    createBill: 'Record the bill',
    signing: 'Sign in your wallet…',
    yourBills: 'Bills you are on',
    loading: 'Reading the contract…',
    noBills: 'Nothing yet. Record one above.',
    you: 'you',
    outstanding: 'Outstanding',
    settledInFull: 'Settled in full.',
    payShare: 'Pay',
    payPart: 'Pay part',
    partAmount: 'Amount',
    liveFeed: 'Live from the contract',
    liveFeedNote: 'Events as ledgers close, roughly every five seconds. Someone else settling shows up here without a refresh.',
    evCreated: 'created',
    evSettled: 'settled',
  },

  hero: {
    line1: 'Who owes what,',
    line2: "and who has paid.",
    sub: "Split any group bill in seconds. Every payment settles on Stellar, so the proof is the ledger, not a screenshot.",
    primary: 'Split a bill',
    secondary: 'See how it settles',
  },

  demo: {
    total: 'Total bill',
    people: 'people',
    equal: 'equal',
    weighted: 'weighted',
    splitType: 'Split type',
    fewer: 'Fewer people',
    more: 'More people',
    decrease: (name: string) => `Decrease ${name}'s share`,
    increase: (name: string) => `Increase ${name}'s share`,
    tapHint: 'Tap a name to set who fronted it',
    fronted: 'fronted the bill',
    owes: 'owes',
    sumsExact: 'Shares sum to the total, exactly',
    sumsAlways: 'Shares always sum to the total',
    errMin: 'A split needs at least two people.',
    errAmount: 'Enter a whole amount, up to 7 decimal places.',
    errZero: 'Enter an amount above zero.',
  },

  problem: {
    title: 'A group chat is not a ledger.',
    lede: 'Four failures every group already knows, and not one of them is about how fast money moves.',
    items: [
      {
        title: 'The maths is manual',
        body: 'Someone opens a calculator because Sari only had a drink and Bagas brought two friends.',
      },
      {
        title: 'The reminder sinks',
        body: 'You ask once. Three memes later it is gone, and asking a second time feels rude.',
      },
      {
        title: 'The proof is a screenshot',
        body: 'A transfer receipt is just an image, and an image takes about thirty seconds to edit.',
      },
      {
        title: 'One person carries it',
        body: 'The unofficial treasurer fronts the money, tracks it in Notes, and absorbs the awkwardness.',
      },
    ],
  },

  positioning: {
    q1: 'Other apps answer ',
    q2: 'how do I send the money.',
    q3: 'Splitr answers ',
    q4: 'who owes what, whether they have paid, and how we prove it.',
    note: 'In Indonesia, BI-FAST already moves rupiah instantly and for free. We are not competing on speed. We are building the ledger around the payment: the coordination, the status, and the receipt nobody has to take on faith.',
  },

  how: {
    title: 'Only the last step touches a wallet.',
    lede: 'The value arrives before the crypto does. That ordering is the whole design.',
    prev: 'Previous step',
    next: 'Next step',
    oldLabel: 'The old way',
    newLabel: 'With Splitr',
    steps: [
      {
        title: 'Create the group',
        body: 'Add the people who were there. Names are enough, and nobody has to connect a wallet to be counted.',
        old: 'A new group chat',
        now: 'One list, no wallets',
        alt: 'A community gathering under a pavilion, with names being added to a shared list on a tablet.',
      },
      {
        title: 'Add the bill, see the split',
        body: 'Who fronted it, how much it was, and who was in on it. Equal or weighted, recalculated as you type.',
        old: 'A calculator and a guess',
        now: 'Exact to seven decimals',
        alt: 'People around a table with a bill of Rp 450.000 split into equal and weighted shares that sum to the total.',
      },
      {
        title: 'Settle and prove',
        body: 'Each payment carries its own memo, so the ledger is what says it is done. Not a flag inside an app.',
        old: 'A screenshot',
        now: 'A ledger entry',
        alt: 'A crossed-out phone showing a Paid toggle, next to a chain of locked ledger entries each carrying a memo.',
      },
    ],
  },

  bento: {
    title: 'What the ledger does that a chat thread cannot.',
    lede: 'Each of these exists because the old workaround failed in a specific, repeated way.',
    alt: 'An arisan under a pendopo: neighbours sitting in a circle with phones out, tea and a gift being passed around.',
    caption:
      'An arisan. Rotating savings groups like this one are the reason Splitr tracks who has paid, not just how the money moved.',
    sevenBody: 'decimal places of precision, held in integers.',
    sevenCaption: '100,000 split three ways',
    sevenSum: 'adds back to 100,000, exactly',
    cards: [
      {
        title: 'Equal or weighted',
        body: 'One tap for an even split, or a weight per person when somebody ate twice as much. Both land exact.',
      },
      {
        title: 'History from the chain',
        body: 'Reconciliation rebuilds who paid what by reading Horizon, never from a local flag somebody could flip.',
      },
    ],
    verifyTitle: 'Anyone can verify',
    verifyBody:
      'Paste the memo into a block explorer. The proof does not depend on trusting Splitr, or on trusting you.',
  },

  proof: {
    title: 'Why the number is worth trusting.',
    lede: 'Three choices already running in the command line tool, not planned for later.',
    facts: [
      {
        title: 'Integer units, never floats',
        code: 'splitByWeights(total, weights)',
        body: [
          'Every amount is an integer count of 1e-7 units. Split 100,000 three ways and you get ',
          { n: '33333.3333334' },
          ' plus ',
          { n: '33333.3333333' },
          ' twice, which adds back to 100,000 exactly. No fraction is invented, and none is lost.',
        ] as Segment[],
      },
      {
        title: 'The memo is the join key',
        code: 'MemoText("splitr:d40a3505")',
        body: [
          'A payment on a public ledger is only an amount between two accounts. The memo is what makes it self-identifying, which is why two open splits between the same three people never contaminate each other.',
        ] as Segment[],
      },
      {
        title: 'The ledger is the source of truth',
        code: 'split reconcile d40a3505',
        body: [
          'Settlement reconciles against Horizon before it pays, so it is idempotent. Run it twice and the second run sends nothing. A partial payment reports as ',
          { n: 'OPEN, short N' },
          ' rather than quietly rounding itself away.',
        ] as Segment[],
      },
    ],
  },

  stack: {
    title: 'The stack it runs on.',
    lede: 'Five layers. Three of them already carry real transactions on testnet, and two are still ahead.',
    live: 'Live on testnet',
    planned: 'Planned',
    layers: [
      {
        layer: 'Network and transactions',
        protocol: 'Stellar Core + Horizon',
        role: 'Sends and receives payments, checks balances, and reads history.',
        live: true,
      },
      {
        layer: 'Asset',
        protocol: 'Stellar Assets (IDRX)',
        role: 'The unit of value that moves between people.',
        live: true,
      },
      {
        layer: 'Smart contract',
        protocol: 'Soroban (Rust)',
        role: 'Group logic, splitting, and who still owes what.',
        live: true,
      },
      {
        layer: 'On-chain proof',
        protocol: 'Transaction hash + ledger',
        role: 'The receipt that says paid, and that nobody can forge.',
        live: true,
      },
      {
        layer: 'Rupiah on and off ramp',
        protocol: 'SEP-24 anchor',
        role: 'Swapping IDR for stablecoin and back again.',
        live: false,
      },
    ],
  },

  faq: {
    title: 'Questions people ask first.',
    items: [
      {
        q: 'Do I need crypto to try it?',
        a: 'No. Creating a group and splitting a bill needs nothing but names. No wallet, no balance, no signup. The wallet only matters at the moment somebody actually settles, and that is the last step rather than the first.',
      },
      {
        q: 'Do my friends need a wallet?',
        a: 'Only to pay you on chain. Splitr sponsors their account reserve and covers the transaction fee, so nobody has to buy XLM before they can send you money. Requiring that first was the biggest onboarding wall we found.',
      },
      {
        q: 'Is this real money?',
        a: 'Not yet. Splitr runs on Stellar testnet with a test stablecoin called IDRX. Treat every number here as a rehearsal: a correct, on chain, verifiable rehearsal, but a rehearsal.',
      },
      {
        q: 'What ends up public on the chain?',
        a: 'The amount, the two account addresses, and the memo. Names, notes, and the shape of the group stay in the app. The chain carries the settlement, not the social graph.',
      },
      {
        q: 'What does a settlement cost?',
        a: 'A fraction of a cent. Splitr bids twice the network p90 fee, capped at 0.01 XLM, and Stellar charges the market clearing rate rather than your bid, so a surge costs you a rounding error instead of a surprise.',
      },
    ],
  },

  finalCta: {
    title: 'Try it on one bill.',
    sub: 'Nothing to install and nothing to connect. If the split looks right, the rest of Splitr is making it settle.',
  },

  footer: {
    blurb:
      'Group bills, settled in stablecoin on Stellar. Built for the friends, arisan and small businesses already doing this by hand.',
    testnet:
      'Splitr runs on Stellar testnet with a test stablecoin called IDRX. No rupiah moves into or out of a bank account yet.',
    built: 'Built on Stellar',
    rights: '© 2026 Splitr',
  },
};

/** The English dictionary is the schema. `id` must match it exactly. */
export type Copy = typeof en;

const id: Copy = {
  meta: {
    title: 'Splitr: siapa berutang berapa, dan buktinya sudah bayar',
    description:
      'Splitr mengubah patungan grup yang berantakan jadi satu buku kas yang beres. Bagi dalam hitungan detik, tidak perlu nagih, dan biar ledger Stellar yang bilang siapa sudah lunas, bukan screenshot.',
  },

  nav: {
    how: 'Cara kerja',
    proof: 'Di balik layar',
    faq: 'Tanya jawab',
    app: 'Aplikasi',
  },

  a11y: {
    toLight: 'Ganti ke tema terang',
    toDark: 'Ganti ke tema gelap',
    language: 'Bahasa',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
  },

  wallet: {
    connect: 'Hubungkan wallet',
    connecting: 'Menghubungkan…',
    disconnect: 'Putuskan',
    connected: 'Tersambung',
    custody: 'Splitr tidak pernah melihat secret key Anda. Anda tanda tangan di wallet sendiri.',
    failed: 'Gagal menghubungkan',
  },

  app: {
    title: 'Tagihan Anda',
    lede: 'Tagihan sungguhan di contract yang sudah live. Contract yang menghitung setiap bagian dan memindahkan uangnya di panggilan yang sama saat mencatatnya — tidak ada yang mock di sini.',
    connectFirst: 'Hubungkan wallet untuk melihat tagihan yang melibatkan Anda.',
    newBill: 'Tagihan baru',
    group: 'Untuk apa',
    total: 'Total',
    members: 'Siapa saja yang ikut',
    membersHint: 'Alamat Stellar, pisahkan dengan koma. Anda otomatis masuk sebagai yang nalangin.',
    createBill: 'Catat tagihannya',
    signing: 'Tanda tangan di wallet…',
    yourBills: 'Tagihan yang melibatkan Anda',
    loading: 'Membaca contract…',
    noBills: 'Belum ada. Catat satu di atas.',
    you: 'Anda',
    outstanding: 'Belum lunas',
    settledInFull: 'Lunas semua.',
    payShare: 'Bayar',
    payPart: 'Bayar sebagian',
    partAmount: 'Jumlah',
    liveFeed: 'Langsung dari contract',
    liveFeedNote: 'Event tiap ledger ditutup, kira-kira lima detik sekali. Orang lain yang bayar langsung muncul di sini tanpa refresh.',
    evCreated: 'dibuat',
    evSettled: 'dibayar',
  },

  hero: {
    line1: "Siapa utang berapa,",
    line2: "dan siapa sudah bayar.",
    sub: "Bagi tagihan grup dalam hitungan detik. Setiap pembayaran diselesaikan di Stellar, jadi buktinya ada di ledger, bukan di screenshot.",
    primary: 'Bagi tagihan',
    secondary: 'Lihat cara bayarnya',
  },

  demo: {
    total: 'Total tagihan',
    people: 'orang',
    equal: 'rata',
    weighted: 'custom',
    splitType: 'Jenis pembagian',
    fewer: 'Kurangi orang',
    more: 'Tambah orang',
    decrease: (name: string) => `Kurangi porsi ${name}`,
    increase: (name: string) => `Tambah porsi ${name}`,
    tapHint: 'Ketuk nama untuk pilih siapa yang nalangin',
    fronted: 'nalangin',
    owes: 'berutang',
    sumsExact: 'Jumlah semua bagian pas dengan total',
    sumsAlways: 'Jumlah bagian selalu pas dengan total',
    errMin: 'Patungan butuh minimal dua orang.',
    errAmount: 'Masukkan nominal bulat, maksimal 7 angka desimal.',
    errZero: 'Masukkan nominal di atas nol.',
  },

  problem: {
    title: 'Grup chat bukan buku kas.',
    lede: 'Empat masalah yang sudah dikenal semua grup, dan tidak satu pun soal secepat apa uangnya berpindah.',
    items: [
      {
        title: 'Hitungannya manual',
        body: 'Ada yang buka kalkulator karena Sari cuma pesan minum dan Bagas bawa dua temannya.',
      },
      {
        title: 'Tagihannya tenggelam',
        body: 'Nagih sekali. Tiga meme kemudian pesannya hilang, dan nagih lagi rasanya nggak enak.',
      },
      {
        title: 'Buktinya cuma screenshot',
        body: 'Bukti transfer itu cuma gambar, dan gambar bisa diedit dalam tiga puluh detik.',
      },
      {
        title: 'Satu orang menanggung semuanya',
        body: 'Bendahara dadakan yang nalangin, mencatat di Notes, dan menanggung canggungnya sendiri.',
      },
    ],
  },

  positioning: {
    q1: 'Aplikasi lain menjawab ',
    q2: 'bagaimana caranya kirim uang.',
    q3: 'Splitr menjawab ',
    q4: 'siapa berutang berapa, sudah bayar belum, dan bagaimana membuktikannya.',
    note: 'Di Indonesia, BI-FAST sudah memindahkan rupiah secara instan dan gratis. Kami tidak bersaing soal kecepatan. Kami membangun buku kas di sekeliling pembayarannya: koordinasinya, statusnya, dan bukti yang tidak perlu dipercaya begitu saja.',
  },

  how: {
    title: 'Cuma langkah terakhir yang butuh wallet.',
    lede: 'Manfaatnya datang lebih dulu daripada kriptonya. Urutan itu inti desainnya.',
    prev: 'Langkah sebelumnya',
    next: 'Langkah berikutnya',
    oldLabel: 'Cara lama',
    newLabel: 'Dengan Splitr',
    steps: [
      {
        title: 'Buat grupnya',
        body: 'Tambahkan orang-orang yang ikut. Cukup nama, dan tidak ada yang perlu connect wallet untuk masuk hitungan.',
        old: 'Bikin grup chat baru',
        now: 'Satu daftar, tanpa wallet',
        alt: 'Kumpul warga di bawah pendopo, nama-nama sedang ditambahkan ke satu daftar bersama lewat tablet.',
      },
      {
        title: 'Tambah tagihan, lihat pembagiannya',
        body: 'Siapa yang nalangin, berapa totalnya, dan siapa saja yang ikut. Rata atau custom, dihitung ulang sambil Anda mengetik.',
        old: 'Kalkulator dan kira-kira',
        now: 'Presisi sampai tujuh desimal',
        alt: 'Orang-orang mengelilingi meja dengan tagihan Rp 450.000 yang dibagi rata dan custom, jumlahnya pas ke total.',
      },
      {
        title: 'Bayar dan buktikan',
        body: 'Tiap pembayaran membawa memonya sendiri, jadi ledger yang bilang sudah lunas. Bukan penanda di dalam aplikasi.',
        old: 'Screenshot',
        now: 'Catatan di ledger',
        alt: 'Ponsel dicoret yang menampilkan tombol Paid, di sebelah rangkaian catatan ledger terkunci yang masing-masing membawa memo.',
      },
    ],
  },

  bento: {
    title: 'Yang bisa dilakukan buku kas, dan tidak bisa dilakukan grup chat.',
    lede: 'Semuanya ada karena cara lama gagal dengan pola yang sama, berulang kali.',
    alt: 'Arisan di bawah pendopo: warga duduk melingkar sambil memegang ponsel, teh dan bingkisan diedarkan.',
    caption:
      'Arisan. Kelompok simpan pinjam bergilir seperti ini alasan Splitr melacak siapa yang sudah bayar, bukan cuma bagaimana uangnya berpindah.',
    sevenBody: 'angka desimal presisi, disimpan sebagai bilangan bulat.',
    sevenCaption: '100.000 dibagi untuk tiga orang',
    sevenSum: 'kembali pas ke 100.000',
    cards: [
      {
        title: 'Rata atau custom',
        body: 'Sekali ketuk untuk bagi rata, atau atur porsi per orang kalau ada yang makan dua kali lipat. Dua-duanya presisi.',
      },
      {
        title: 'Riwayat dari rantai',
        body: 'Rekonsiliasi menyusun ulang siapa membayar apa dengan membaca Horizon, bukan dari penanda lokal yang bisa diubah siapa saja.',
      },
    ],
    verifyTitle: 'Siapa pun bisa memverifikasi',
    verifyBody:
      'Tempel memonya ke block explorer. Buktinya tidak bergantung pada percaya ke Splitr, atau percaya ke Anda.',
  },

  proof: {
    title: 'Kenapa angkanya bisa dipercaya.',
    lede: 'Tiga keputusan yang sudah berjalan di tool command line, bukan rencana untuk nanti.',
    facts: [
      {
        title: 'Bilangan bulat, bukan floating point',
        code: 'splitByWeights(total, weights)',
        body: [
          'Setiap nominal adalah hitungan bulat dari satuan 1e-7. Bagi 100.000 untuk tiga orang dan hasilnya ',
          { n: '33333.3333334' },
          ' plus ',
          { n: '33333.3333333' },
          ' dua kali, yang kembali pas ke 100.000. Tidak ada pecahan yang diciptakan, tidak ada yang hilang.',
        ] as Segment[],
      },
      {
        title: 'Memo adalah kunci penghubungnya',
        code: 'MemoText("splitr:d40a3505")',
        body: [
          'Pembayaran di ledger publik cuma sejumlah nominal antara dua akun. Memo yang membuatnya bisa mengenali dirinya sendiri, dan itu sebabnya dua patungan yang sama-sama terbuka di antara tiga orang yang sama tidak pernah tertukar.',
        ] as Segment[],
      },
      {
        title: 'Ledger adalah sumber kebenarannya',
        code: 'split reconcile d40a3505',
        body: [
          'Pembayaran direkonsiliasi ke Horizon sebelum uangnya dikirim, jadi sifatnya idempoten. Jalankan dua kali, yang kedua tidak mengirim apa pun. Pembayaran sebagian dilaporkan sebagai ',
          { n: 'OPEN, short N' },
          ', bukan dibulatkan diam-diam.',
        ] as Segment[],
      },
    ],
  },

  stack: {
    title: 'Tumpukan yang menjalankannya.',
    lede: 'Lima lapisan. Tiga di antaranya sudah membawa transaksi sungguhan di testnet, dua sisanya masih di depan.',
    live: 'Jalan di testnet',
    planned: 'Rencana',
    layers: [
      {
        layer: 'Jaringan dan transaksi',
        protocol: 'Stellar Core + Horizon',
        role: 'Kirim dan terima pembayaran, cek saldo, baca riwayat.',
        live: true,
      },
      {
        layer: 'Aset',
        protocol: 'Stellar Assets (IDRX)',
        role: 'Satuan nilai yang dikirim antar orang.',
        live: true,
      },
      {
        layer: 'Smart contract',
        protocol: 'Soroban (Rust)',
        role: 'Logika grup, pembagian, dan siapa yang masih berutang.',
        live: true,
      },
      {
        layer: 'Bukti on-chain',
        protocol: 'Transaction hash + ledger',
        role: 'Bukti lunas yang tidak bisa dipalsukan.',
        live: true,
      },
      {
        layer: 'On/off-ramp Rupiah',
        protocol: 'SEP-24 anchor',
        role: 'Tukar IDR ke stablecoin dan sebaliknya.',
        live: false,
      },
    ],
  },

  faq: {
    title: 'Yang paling sering ditanya.',
    items: [
      {
        q: 'Perlu punya kripto dulu untuk coba?',
        a: 'Tidak. Membuat grup dan membagi tagihan cuma butuh nama. Tanpa wallet, tanpa saldo, tanpa daftar akun. Wallet baru relevan saat ada yang benar-benar membayar, dan itu langkah terakhir, bukan langkah pertama.',
      },
      {
        q: 'Teman saya harus punya wallet?',
        a: 'Cuma kalau mau membayar lewat on-chain. Splitr menanggung reserve akun dan biaya transaksinya, jadi tidak ada yang perlu beli XLM dulu sebelum bisa mengirim uang ke Anda. Mewajibkan itu di awal adalah hambatan terbesar yang kami temukan.',
      },
      {
        q: 'Ini uang beneran?',
        a: 'Belum. Splitr jalan di Stellar testnet dengan stablecoin uji bernama IDRX. Anggap semua angka di sini gladi bersih: gladi bersih yang benar, tercatat on-chain, dan bisa diverifikasi, tapi tetap gladi bersih.',
      },
      {
        q: 'Apa saja yang jadi publik di rantai?',
        a: 'Nominalnya, dua alamat akun, dan memonya. Nama, catatan, dan susunan grupnya tetap di aplikasi. Yang dibawa ke rantai adalah penyelesaiannya, bukan siapa berteman dengan siapa.',
      },
      {
        q: 'Berapa biaya sekali bayar?',
        a: 'Sepersekian sen. Splitr menawar dua kali biaya p90 jaringan, dibatasi 0,01 XLM, dan Stellar menagih tarif pasar, bukan tawaran Anda. Jadi lonjakan biaya cuma jadi pembulatan, bukan kejutan.',
      },
    ],
  },

  finalCta: {
    title: 'Coba dulu di satu tagihan.',
    sub: 'Tidak ada yang perlu diinstal, tidak ada yang perlu disambungkan. Kalau pembagiannya sudah benar, sisanya tinggal membuatnya terbayar.',
  },

  footer: {
    blurb:
      'Tagihan grup, diselesaikan dengan stablecoin di Stellar. Dibuat untuk geng, arisan, dan usaha kecil yang selama ini melakukannya manual.',
    testnet:
      'Splitr jalan di Stellar testnet dengan stablecoin uji bernama IDRX. Belum ada rupiah yang masuk atau keluar rekening bank.',
    built: 'Dibangun di Stellar',
    rights: '© 2026 Splitr',
  },
};

export const COPY = { en, id };
export type Lang = keyof typeof COPY;
