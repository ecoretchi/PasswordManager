# PasswordManager

A lightweight, client‑side password manager that stores all secrets **encrypted in the browser** and gives the user full control over **sync, backup, and portability**.

The application is designed with a *local‑first* and *zero‑knowledge* approach: encryption and decryption happen only on the user’s device.

---

## Key Features

* 🔐 **Encrypted Local Storage**
  All password data is stored as a **single encrypted vault** inside `localStorage`.

* 🧠 **Master Password**
  A master password is used to derive an encryption key. The master password is **never stored**.

* ☁️ **Google Drive Sync (Optional)**
  The encrypted vault can be uploaded to and restored from the user’s Google Drive.

* 💾 **Export / Import**
  Export the encrypted vault to a local file or import it on another device or browser.

* 👤 **Multi‑User Support**
  Supports multiple users on the same browser by isolating vaults via unique identifiers.

---

## Architecture Overview

### Storage Model

* One encrypted object per user
* Stored as:

  ```
  localStorage[PasswordManager:<UserId>]
  ```
* The stored value is a **binary‑safe encrypted blob** (Base64 encoded)

### Vault Lifecycle

1. User enters master password
2. Encryption key is derived locally
3. Encrypted vault is decrypted in memory
4. User works with plaintext data **only in RAM**
5. On save → data is re‑encrypted and persisted

---

## Encryption & Security

### Cryptography

The application relies entirely on the **Web Crypto API** and modern, well‑established primitives.

* **Hashing:** SHA‑256 (used for data/version hashing)
* **Key derivation:** PBKDF2 (SHA‑256, 100,000 iterations)
* **Encryption:** AES‑256‑GCM
* **IV:** Random 96‑bit IV generated per encryption
* **Salt:** Random 128‑bit salt generated per user

### Key Derivation Model

* The encryption key is derived from:

  * the user identifier
  * the master password
  * a per‑user random salt
* The master password is **never stored** and exists only in memory
* A unique encryption key is generated for each user and browser context

### Encrypted Payload Format

* Encrypted data consists of:

  * random IV
  * AES‑GCM encrypted payload
* IV and ciphertext are combined and stored as a **Base64‑encoded blob**

### Decryption Behavior

* Decryption happens only in memory
* If the master password is incorrect, decryption fails safely
* Authentication is guaranteed by AES‑GCM integrity checks

### Security Guarantees

* Plaintext secrets are never persisted
* `localStorage`, Google Drive, and exported files contain **only encrypted data**
* Access to stored data alone is insufficient to recover secrets

> ⚠️ Loss of the master password makes the vault permanently unrecoverable.

---

## Google Drive Sync

### How It Works

* OAuth is used to access the user’s Drive
* A single encrypted file is created (e.g. `password-manager-vault.enc`)
* Sync modes:

  * Upload local vault → Drive
  * Download Drive vault → local storage

### Permissions

* Minimal Drive scope
* No access to other user files

---

## Export & Import

### Export

* Produces an encrypted file (`.enc` or `.json`)
* Can be safely backed up or transferred

### Import

* Replaces or merges with existing vault
* Requires the correct master password

---

## Threat Model

### Protected Against

* Casual local access to browser storage
* Cloud provider data inspection
* File theft (exported backups)

### Not Protected Against

* Compromised browser or OS
* Keyloggers or malicious extensions
* Weak master passwords

---

## Design Principles

* 🔒 Local‑first & zero‑knowledge
* 📦 Single encrypted object
* 🔄 Explicit user‑controlled sync
* 🧩 No backend required

---

## Disclaimer

This project is intended for **personal use and learning purposes**.
It has not undergone a professional security audit.

Use at your own risk.
