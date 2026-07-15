# Accesso amministratore su GitHub Pages

Prima della pubblicazione, autorizza il dominio che ospita il sito:

1. Apri la console Firebase del progetto `aws-starbattle`.
2. Vai in **Authentication** > **Settings** > **Authorized domains**.
3. Aggiungi il dominio GitHub Pages, nel formato `nome-account.github.io` (senza `https://` e senza il nome della repository). Aggiungi anche l'eventuale dominio personalizzato.
4. In **Authentication** > **Sign-in method**, verifica che il provider **Google** sia abilitato.
5. Vai in **Firestore Database** > **Rules**, incolla il contenuto di `firestore.rules` e pubblicalo.

Firebase deve conoscere il dominio di GitHub Pages: questa autorizzazione non può essere inclusa nel codice del sito, perché è una protezione gestita dal progetto Firebase. Una volta aggiunto il dominio, l'accesso con l'account presente in `allowedAdmins` funziona sia in locale sia sul sito pubblicato.
