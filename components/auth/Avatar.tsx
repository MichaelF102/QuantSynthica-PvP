import { cn } from '@/lib/utils';

/** The Google photo, or the first letter of the name on a blue disc when there is none. */
export function Avatar({ name, photoURL, size = 28, className }: { name: string | null; photoURL: string | null; size?: number; className?: string }) {
  const letter = (name?.trim()[0] ?? '?').toUpperCase();
  if (photoURL) {
    return (
      // A plain <img>: the photo comes from Google's servers and needs no Next image optimisation.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoURL} alt="" width={size} height={size} referrerPolicy="no-referrer" className={cn('rounded-full border border-slate-700 object-cover', className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <span aria-hidden className={cn('inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold', className)} style={{ width: size, height: size }}>
      {letter}
    </span>
  );
}
