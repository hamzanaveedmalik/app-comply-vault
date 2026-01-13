/**
 * Script to link Google account to existing user who previously used Discord
 * Run with: npx tsx scripts/link-google-account.ts <user-email>
 */

import { db } from "../src/server/db";

async function linkGoogleAccount(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email})`);
  console.log(`Existing accounts: ${user.accounts.map(a => a.provider).join(", ")}`);

  // Delete Discord account so user can sign in with Google
  const discordAccount = user.accounts.find(a => a.provider === "discord");
  
  if (discordAccount) {
    console.log("Deleting Discord account...");
    await db.account.delete({
      where: { id: discordAccount.id },
    });
    console.log("✅ Discord account deleted. User can now sign in with Google.");
  } else {
    console.log("No Discord account found. User can sign in with Google to create new account link.");
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/link-google-account.ts <user-email>");
  process.exit(1);
}

linkGoogleAccount(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
