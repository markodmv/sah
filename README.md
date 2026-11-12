# Šah – turniri i igrači

Samostalna Next.js aplikacija na Vercelu (https://sah-app.vercel.app), bez prijave i bez veze s drugim aplikacijama.

- Turniri u Hrvatskoj s [chess-results.com](https://chess-results.com/fed.aspx?lan=1&fed=CRO) po dobnim skupinama i tempu igre.
- Praćeni igrači: FIDE rejting, prijave na turnire i rezultati.
- Podaci: jedna privatna JSON datoteka u Vercel Blob pohrani `sah-podaci` (`lib/sah/pohrana.ts`).
- Osvježavanje: gumb ↻ Osvježi, automatski pri otvaranju ako su podaci stariji od sat vremena, i dnevno u 6/7 h (Vercel cron, `vercel.json`).
- Objava: `npx vercel deploy --prod --scope markovasek-2296`.
