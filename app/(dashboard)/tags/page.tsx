import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";

export default async function TagsPage() {
  await requireSession();

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-muted-foreground">{tags.length} tag{tags.length !== 1 ? "s" : ""}</p>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tags yet</p>
          <p className="text-sm">Tags are created when editing a contact.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.id}`}>
              <Badge
                variant="outline"
                className="text-sm px-3 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
              >
                {tag.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {tag._count.contacts}
                </span>
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
