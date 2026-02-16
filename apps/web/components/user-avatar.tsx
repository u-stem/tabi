import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSeasonalBg } from "@/lib/season";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  image?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({ name, image, className, fallbackClassName }: UserAvatarProps) {
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    // Radix Avatar keeps imageLoadingStatus after AvatarImage unmounts; key forces remount
    <Avatar key={image ?? ""} className={className}>
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback
        className={cn(getSeasonalBg(), "text-sm font-medium text-white", fallbackClassName)}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
