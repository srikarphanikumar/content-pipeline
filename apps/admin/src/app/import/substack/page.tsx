import { AdminShell, SecondaryLink } from "../../components/AdminShell";
import { ImportSubstackForm } from "./ImportSubstackForm";

export const dynamic = "force-dynamic";

export default function ImportSubstackPage() {
  return (
    <AdminShell
      actions={<SecondaryLink href="/posts">All posts</SecondaryLink>}
      description="Paste the Substack publication URL or RSS feed URL. The importer previews feed items, skips duplicates, and creates canonical posts on blog.mspk.me."
      eyebrow="Import"
      title="Substack archive"
    >
      <section>
        <ImportSubstackForm />
      </section>
    </AdminShell>
  );
}
