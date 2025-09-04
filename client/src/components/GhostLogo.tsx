import ghostLogo from '@assets/Screenshot_2025-08-31-16-26-19-172_com.android.vending-edit_1756912945485.jpg';

export default function GhostLogo() {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden">
      <img src={ghostLogo} alt="👻" className="w-full h-full object-cover" />
    </div>
  );
}