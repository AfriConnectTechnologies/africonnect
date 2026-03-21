import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { AdminApiDocsViewer } from "@/components/admin/admin-api-docs-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasAdminDocsAccess } from "@/lib/admin-docs";

export const metadata: Metadata = {
  title: "Private API Docs",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function AdminApiDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const allowed = await hasAdminDocsAccess();

  if (!allowed) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Private API documentation</h1>
        <p className="max-w-3xl text-muted-foreground">Admin-only API spec viewer.</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Lock className="h-4 w-4" />
            Access controls
          </div>
          <CardTitle>Admin-only access</CardTitle>
          <CardDescription>Protected by app authentication and admin role checks.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Swagger UI</CardTitle>
          <CardDescription>The viewer loads the protected YAML from <code>/api/admin/docs/openapi</code>.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminApiDocsViewer />
        </CardContent>
      </Card>
    </div>
  );
}
