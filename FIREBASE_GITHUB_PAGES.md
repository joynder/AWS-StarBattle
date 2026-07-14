# Password area riservata su GitHub Pages

L'area riservata usa la password configurata nel sito (`starbattle`) e non richiede più l'accesso Google.

Firebase continua a conservare tornei, squadre, regole e sponsor, così le modifiche rimangono visibili a tutti. Prima della pubblicazione apri la console Firebase del progetto `aws-starbattle`, vai in **Firestore Database** > **Rules**, copia il contenuto di `firestore.rules` e pubblicalo.

Le nuove regole permettono scritture senza autenticazione Firebase. La password protegge l'interfaccia del sito, ma non impedisce a chi conosce il progetto Firebase di provare a modificare direttamente il database.
