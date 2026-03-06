# Rwanda FDA API

Express + MySQL API for the Rwanda FDA mobile app. Uses the same auth as the Monitoring Tool web (`includes/auth.php`): `tbl_hm_users` and `tbl_staff`.

## Database on Namecheap shared hosting

Namecheap **disables direct remote MySQL** on shared hosting. You must use an **SSH tunnel** so the API connects via localhost.

**Reference:** [Namecheap: How to remotely connect to MySQL](https://www.namecheap.com/support/knowledgebase/article.aspx/1249/89/how-to-remotely-connect-to-a-mysql-database-located-on-our-shared-server/)

### 1. Get your SSH details from cPanel

- **SSH host:** your server hostname (e.g. from Welcome Email or cPanel)
- **SSH port:** usually `21098` for Namecheap shared hosting
- **Username:** your cPanel username  
- **Password:** your cPanel password  

Ensure SSH access is enabled for your account in cPanel.

### 2. Start the SSH tunnel (Terminal on Mac/Linux)

Pick a **local port** not in use (e.g. `5522`).

**Using SSH key (recommended if you generated a key in cPanel):**

Put your private key somewhere safe (e.g. `~/.ssh/namecheap_rsa`). Then run:

```bash
ssh -i ~/.ssh/namecheap_rsa -f YOUR_CPANEL_USER@YOUR_SERVER_HOSTNAME -p 21098 -L 5522:127.0.0.1:3306 -N
```

Replace `~/.ssh/namecheap_rsa` with the path to your **private** key file. No password prompt if the key is set up correctly.

**Using cPanel password:**

```bash
ssh -f YOUR_CPANEL_USER@YOUR_SERVER_HOSTNAME -p 21098 -L 5522:127.0.0.1:3306 -N
```

Enter your cPanel password when prompted.

The tunnel stays open as long as that terminal session is active. **Keep that terminal window open** while running the API.

### 3. Point the API at the tunnel

In `server/.env` set:

```env
DB_HOST=127.0.0.1
DB_PORT=5522
DB_USER=newrwandafdagov
DB_PASSWORD=your-db-password
DB_NAME=newrwandafdagov_fdaweb
```

Use the **same** local port in `-L 5522:...` and `DB_PORT=5522`.

### 4. Run the API

```bash
npm run server
```

Login and other endpoints will use MySQL through the tunnel.

### Production

On a server that can reach the database (e.g. same host as the web, or VPN), you can use direct DB connection with `DB_HOST` set to the DB server. The SSH tunnel is for **local development** when the DB is on Namecheap shared hosting.
