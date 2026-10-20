import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostComposer } from "@/components/PostComposer";
import type { CarTag } from "@/components/CarTagFields";

export function CreatePostModal({
  open,
  onOpenChange,
  initialBody,
  title = "New post",
  helpPost,
  initialIssueSystem,
  initialCarTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBody?: string;
  title?: string;
  /** A help post (e.g. from "Fix a problem"), already sorted by part of the car. */
  helpPost?: boolean;
  initialIssueSystem?: string | undefined;
  initialCarTag?: CarTag | undefined;
}) {
  const queryClient = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <PostComposer
          bare
          {...(initialBody ? { initialBody } : {})}
          {...(helpPost ? { helpPost, initialIssueSystem, initialCarTag } : {})}
          onPosted={() => {
            queryClient.invalidateQueries({ queryKey: ["feed"] });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
