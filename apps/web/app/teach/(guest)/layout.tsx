import { AuthShell } from "@/components/auth/AuthShell";

export default function TeacherAuthLayout({ children }: LayoutProps<"/teach">) {
  return <AuthShell variant="teacher">{children}</AuthShell>;
}
