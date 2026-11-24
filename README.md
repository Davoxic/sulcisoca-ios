# SulcisOca – iOS

Gioco dell'oca low-poly ambientato nel Sulcis, **in singolo contro da 1 a 5 bot** (difficoltà facile, normale, difficile, demon).
Gira **tutto offline** sul dispositivo: nessun server, nessuna connessione.

## Scarica
Vai su **Releases** → ultima versione → `SulcisOca-unsigned.ipa`.
L'IPA **non è firmata**: per installarla serve uno strumento di sideload (AltStore, SideStore, Sideloadly, TrollStore…).

## Build
Ogni push su `main` genera il progetto con XcodeGen, compila senza firma su GitHub Actions (macOS) e pubblica l'IPA nelle Releases.
Il gioco è nella cartella `www`.
