import pool from '../db/connection.js';

async function main() {
  const [pingRows] = await pool.execute('SELECT 1 AS ok');
  const [dbRows] = await pool.execute('SELECT DATABASE() AS db_name');
  const [usersTblRows] = await pool.execute(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tbl_hm_users'"
  );
  const [staffTblRows] = await pool.execute(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tbl_staff'"
  );

  console.log('DB connection: OK');
  console.log(`Database: ${dbRows?.[0]?.db_name || '(none selected)'}`);
  console.log(`Ping: ${pingRows?.[0]?.ok === 1 ? 'OK' : 'FAILED'}`);
  console.log(`tbl_hm_users exists: ${(usersTblRows?.[0]?.n ?? 0) > 0 ? 'YES' : 'NO'}`);
  console.log(`tbl_staff exists: ${(staffTblRows?.[0]?.n ?? 0) > 0 ? 'YES' : 'NO'}`);
} 

main()
  .catch((err) => {
    console.error('DB connection test failed');
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore pool close errors in CLI
    }
  });

