/**
 * Shared product mark. The asset is supplied by public/favicon.png.
 * Keep the cubixgear wordmark visible when an environment has not yet
 * deployed the binary file instead of drawing the old CG placeholder.
 */
export function CubixgearLogo() {
  return (
    <img
      src="/favicon.png"
      alt=""
      className="cubixgear-logo-image"
      width={44}
      height={44}
      decoding="async"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}
