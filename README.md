# Cosmo Shøp - Bot

Starter Discord bota do obsługi sklepu, produktów i zamówień.

## Co potrafi obecna wersja

- `/sklep` — pokazuje produkty
- `/produkty` — pokazuje produkty wraz z ID
- `/produkt-dodaj` — dodaje produkt (dla osób z uprawnieniem Zarządzaj serwerem)
- `/produkt-usun` — usuwa produkt (dla osób z uprawnieniem Zarządzaj serwerem)
- `/zamow` — tworzy zamówienie
- `/zamowienia` — pokazuje ostatnie zamówienia (dla osób z uprawnieniem Zarządzaj serwerem)
- zapisuje ID serwera, ID użytkownika, produkty i zamówienia w `data.json`

## Uruchomienie

Wymagany Node.js 20 lub nowszy.

1. Skopiuj `.env.example` do `.env`.
2. Wpisz do `.env`:
   - `DISCORD_TOKEN` — token bota
   - `CLIENT_ID` — Application ID / Client ID aplikacji
   - `GUILD_ID` — ID serwera (opcjonalne, ale polecane podczas testów)
3. W terminalu uruchom:
   `npm install`
4. Następnie:
   `npm start`

### Ważne

Nigdy nie publikuj tokena bota na GitHubie ani nie wysyłaj go nikomu. Plik `.env` nie powinien być wrzucany do repozytorium.

To jest wersja startowa. Nie zawiera prawdziwych płatności ani automatycznej dostawy produktów.
