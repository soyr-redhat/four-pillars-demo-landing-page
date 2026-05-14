import { publicUrl } from '../publicUrl';

const hatSrc = publicUrl('hat-logo.png');

type Props = {
  className?: string;
  /** Display size in CSS pixels (width and height; image scales with object-fit). */
  size?: number;
  alt?: string;
};

export function HatLogo({ className, size = 80, alt = '' }: Props) {
  return (
    <img
      src={hatSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'contain', width: size, height: size }}
      draggable={false}
    />
  );
}
