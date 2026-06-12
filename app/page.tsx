import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import UnauthenticatedWelcome from "@/components/organisms/UnauthenticatedWelcome";
import DashboardWorkspace from "@/components/organisms/DashboardWorkspace";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  // Fetch session user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <UnauthenticatedWelcome />;
  }

  return <DashboardWorkspace user={user} />;
}
