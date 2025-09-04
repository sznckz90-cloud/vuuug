const ghostLogo = '/ghost-logo.jpg';

export default function GhostLogo() {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden">
      <img src={ghostLogo} alt="👻" className="w-full h-full object-cover" />
    </div>
  );
}