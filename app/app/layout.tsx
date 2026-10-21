import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { redis } from "@/lib/server/redis";
import E2EBootstrap from "@/app/app/E2EBootstrap";
import GlobalPresence from "@/app/app/GlobalPresence";
import GlobalMusicPlayer from "@/app/app/GlobalMusicPlayer";
import GlobalVoicePlayer from "@/app/app/GlobalVoicePlayer";
import GlobalLiveBackground from "@/app/app/GlobalLiveBackground";
import AppSecurityWatcher from "@/app/app/AppSecurityWatcher";
import EmailMigrationGate from "@/app/app/EmailMigrationGate";
import AppNotificationsBootstrap from "@/app/app/AppNotificationsBootstrap";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const verifyKey = `email:verify:required:${user.id}`;
  if (!user.verified || !user.email) {
    await redis.set(verifyKey, "1", "EX", 60 * 60 * 24 * 30);
    redirect("/sign-up");
  } else {
    await redis.del(verifyKey);
  }

  return (
    <>
      <GlobalLiveBackground />
      <div className="relative z-10">
      <E2EBootstrap />
      <GlobalPresence />
      <GlobalMusicPlayer />
      <GlobalVoicePlayer />
      <AppSecurityWatcher />
      <AppNotificationsBootstrap userId={user.id} />
      <EmailMigrationGate email={user.email} verified={user.verified} />
      <div>{children}</div>
      </div>
    </>
  );
}
