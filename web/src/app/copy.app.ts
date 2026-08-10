/**
 * Every visible string in the dApp, in both languages.
 *
 * Split out of `lib/copy.ts` for one reason: that module is imported by the
 * landing page, so anything in it ships in the entry chunk. These strings are
 * only ever read inside `app/`, which is behind the `lazy()` in App.tsx — in
 * `copy.ts` they cost every visitor who came to read the marketing page ~8 kB
 * of Indonesian and English they will never see.
 *
 * The discipline from `copy.ts` carries over unchanged: no visible string is
 * hardcoded in a component, `en` is the schema, and `id` is typed against it so
 * a missing key fails `web:typecheck` instead of rendering a blank.
 */
import { useMemo } from 'react';
import { useLang } from '../lib/i18n.tsx';

const en = {
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
    // ---- the split, before anything touches a wallet
    useGroup: 'Who was in on it',
    adHoc: 'No group — paste addresses',
    weight: 'Share',
    weightHint: 'Relative portions. A 2 pays twice what a 1 pays. Leave them all at 1 for an even split.',
    less: (name: string) => `Give ${name} a smaller share`,
    more: (name: string) => `Give ${name} a larger share`,
    preview: 'What each person owes',
    previewNote: 'Shares sum to the total, exactly — the contract recomputes this and gets the same answer.',
    previewFirst: 'Enter a total to see the split. Nothing is signed or sent until you record it.',
    payerIsYou: 'You fronted it',
    // ---- the wallet gate, stated only once the split is already on screen
    needsAddresses: 'On-chain recording needs a wallet address for everyone on the bill.',
    missingAddresses: (names: string) => `Still missing: ${names}.`,
    groupTooSmall: 'A bill needs at least two people.',
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
    signedInAs: 'Signed in as',
    balance: 'Balance',
    notFunded: 'This account does not exist on the ledger yet. Stellar creates it on first funding — until then it can read, but not sign anything.',
    fundIt: 'Fund it on testnet',
    funding: 'Funding…',
    noTrustline: 'This account has not agreed to hold IDRX yet. Stellar calls that a trustline, and it costs 0.5 XLM in reserve — you sign it in your own wallet.',
    openTrustline: 'Open the IDRX trustline',
    dismiss: 'Dismiss',
    billRecordedPlain: 'Bill recorded on-chain.',
    paidPlain: 'Your share is paid.',
    receiptNote: 'Open it in a block explorer. The proof does not depend on trusting Splitr.',
    billRecorded: (id: number) => `Bill #${id} recorded on-chain.`,
    paid: (amount: string, code: string) => `Paid ${amount} ${code}.`,
    trustlineOpen: (code: string) => `${code} trustline open — this account can hold it now.`,
    funded: 'Account funded on testnet.',
    liveFeed: 'Live from the contract',
    liveFeedNote: 'Events as ledgers close, roughly every five seconds. Someone else settling shows up here without a refresh.',
    evCreated: 'created',
    evSettled: 'settled',
  },

  groups: {
    title: 'Your groups',
    lede: 'The people you split with. Add them by name — a wallet is only needed when a bill goes on chain.',
    localOnly: 'Groups live in this browser. What was settled lives on the ledger; who is in the group does not need to.',
    newGroup: 'New group',
    groupName: 'Group name',
    groupNamePlaceholder: 'Geng Nongkrong',
    create: 'Create',
    noGroups: 'No groups yet. Make one, add the people who were there, and you can split a bill before anyone connects a wallet.',
    memberName: 'Name',
    memberNamePlaceholder: 'Sari',
    memberAddress: 'Stellar address',
    memberAddressOptional: 'optional',
    addressPlaceholder: 'G… (can wait)',
    addMember: 'Add',
    addWallet: 'Add wallet',
    save: 'Save',
    cancel: 'Cancel',
    noWallet: 'no wallet yet',
    badAddress: 'That is not a Stellar address — they start with G and are 56 characters.',
    removeMember: (name: string) => `Remove ${name}`,
    deleteGroup: (name: string) => `Delete ${name}`,
    confirmDelete: (name: string) => `Delete "${name}"? The bills already on chain stay there.`,
    memberCount: (n: number) => (n === 1 ? '1 person' : `${n} people`),
    readyCount: (ready: number, total: number) => `${ready} of ${total} have a wallet`,
  },
};

/** The English dictionary is the schema. `id` must match it exactly. */
export type AppCopy = typeof en;

const id: AppCopy = {
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
    useGroup: 'Siapa saja yang ikut',
    adHoc: 'Tanpa grup — tempel alamatnya',
    weight: 'Porsi',
    weightHint: 'Porsi relatif. Yang 2 bayar dua kali lipat dari yang 1. Biarkan semua 1 kalau dibagi rata.',
    less: (name: string) => `Kurangi porsi ${name}`,
    more: (name: string) => `Tambah porsi ${name}`,
    preview: 'Siapa utang berapa',
    previewNote: 'Jumlah semua porsi pas dengan totalnya — contract menghitung ulang dan hasilnya sama.',
    previewFirst: 'Isi totalnya untuk melihat pembagian. Belum ada yang ditandatangani atau dikirim sampai Anda mencatatnya.',
    payerIsYou: 'Anda yang nalangin',
    needsAddresses: 'Untuk dicatat on-chain, semua orang di tagihan ini butuh alamat wallet.',
    missingAddresses: (names: string) => `Yang belum: ${names}.`,
    groupTooSmall: 'Satu tagihan minimal dua orang.',
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
    signedInAs: 'Masuk sebagai',
    balance: 'Saldo',
    notFunded: 'Akun ini belum ada di ledger. Stellar baru membuatnya saat pertama kali didanai — sebelum itu bisa membaca, tapi tidak bisa menandatangani apa pun.',
    fundIt: 'Danai di testnet',
    funding: 'Mendanai…',
    noTrustline: 'Akun ini belum menyetujui untuk memegang IDRX. Stellar menyebutnya trustline, biayanya 0,5 XLM sebagai reserve — Anda tanda tangan di wallet sendiri.',
    openTrustline: 'Buka trustline IDRX',
    dismiss: 'Tutup',
    billRecordedPlain: 'Tagihan tercatat on-chain.',
    paidPlain: 'Bagian Anda sudah dibayar.',
    receiptNote: 'Buka di block explorer. Buktinya tidak bergantung pada percaya ke Splitr.',
    billRecorded: (id: number) => `Tagihan #${id} tercatat on-chain.`,
    paid: (amount: string, code: string) => `Terbayar ${amount} ${code}.`,
    trustlineOpen: (code: string) => `Trustline ${code} terbuka — akun ini sudah bisa memegangnya.`,
    funded: 'Akun sudah didanai di testnet.',
    liveFeed: 'Langsung dari contract',
    liveFeedNote: 'Event tiap ledger ditutup, kira-kira lima detik sekali. Orang lain yang bayar langsung muncul di sini tanpa refresh.',
    evCreated: 'dibuat',
    evSettled: 'dibayar',
  },

  groups: {
    title: 'Grup Anda',
    lede: 'Orang-orang yang biasa patungan bareng. Tambahkan pakai nama saja — wallet baru perlu waktu tagihannya masuk on-chain.',
    localOnly: 'Grup disimpan di browser ini. Yang sudah dibayar tercatat di ledger; siapa saja anggotanya tidak perlu ke sana.',
    newGroup: 'Grup baru',
    groupName: 'Nama grup',
    groupNamePlaceholder: 'Geng Nongkrong',
    create: 'Buat',
    noGroups: 'Belum ada grup. Buat satu, masukkan orang-orangnya, dan Anda sudah bisa membagi tagihan sebelum ada yang connect wallet.',
    memberName: 'Nama',
    memberNamePlaceholder: 'Sari',
    memberAddress: 'Alamat Stellar',
    memberAddressOptional: 'opsional',
    addressPlaceholder: 'G… (bisa nanti)',
    addMember: 'Tambah',
    addWallet: 'Tambah wallet',
    save: 'Simpan',
    cancel: 'Batal',
    noWallet: 'belum ada wallet',
    badAddress: 'Itu bukan alamat Stellar — diawali G dan panjangnya 56 karakter.',
    removeMember: (name: string) => `Hapus ${name}`,
    deleteGroup: (name: string) => `Hapus ${name}`,
    confirmDelete: (name: string) => `Hapus "${name}"? Tagihan yang sudah on-chain tetap ada di sana.`,
    memberCount: (n: number) => `${n} orang`,
    readyCount: (ready: number, total: number) => `${ready} dari ${total} sudah punya wallet`,
  },
};

const APP_COPY = { en, id };

/**
 * The landing dictionary with the app's own strings merged over it.
 *
 * App components call this instead of `useLang`, so `t.app.*` and `t.groups.*`
 * resolve alongside the shared `t.wallet.*` they also need. One hook rather
 * than two, because a component juggling two dictionaries is how a hardcoded
 * string eventually sneaks in.
 */
export function useAppLang() {
  const { lang, t } = useLang();
  return useMemo(() => ({ lang, t: { ...t, ...APP_COPY[lang] } }), [lang, t]);
}
