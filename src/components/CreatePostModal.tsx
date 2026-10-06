import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostComposer } from "@/components/PostComposer";

export function CreatePostModal({
  open,
  onOpenChange,
  initialBody,
  title = "New post",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBody?: string;
  title?: string;
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
          onPosted={() => {
            queryClient.invalidateQueries({ queryKey: ["feed"] });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
