import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
  console.log("🔍 Attempting to connect to:");
  console.log("Host:", process.env.DB_HOST);
  console.log("Port:", process.env.DB_PORT);
  console.log("User:", process.env.DB_USER);

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    });
    console.log("✅ SUCCESS! The database is connected.");
    conn.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ RAW ERROR DETAILS:");
    console.error(error);
    process.exit(1);
  }
}
testConnection();
