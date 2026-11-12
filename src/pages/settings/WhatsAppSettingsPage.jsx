import { Link } from 'react-router-dom';
import { Copy, MessageCircle, ShieldCheck } from 'lucide-react';
import '../../styles/whatsapp-settings.css';

/** No Meta SDK, webhook, template management, or automatic messaging settings. */
export function WhatsAppSettingsPage() {
  return (
    <main className="wa-settings">
      <div className="wa-header">
        <div>
          <Link to="/settings">Settings</Link><span> / WhatsApp Sharing</span>
          <h1>Manual WhatsApp Sharing</h1>
          <p>Prepare a message in CubixGear. A team member reviews it and presses Send in WhatsApp.</p>
        </div>
      </div>
      <section className="wa-card">
        <h2><MessageCircle size={20}/> How sharing works</h2>
        <p>Open a customer, job, estimate, invoice, payment reminder, or staff profile and select <strong>Share on WhatsApp</strong>.</p>
        <p>CubixGear prepares a secure message and opens WhatsApp on your phone or computer. Nothing is sent automatically.</p>
        <p>No Meta Cloud API, access token, approved template, connection, or WhatsApp Business account is required.</p>
      </section>
      <section className="wa-card">
        <h2><ShieldCheck size={20}/> Private links</h2>
        <p>Staff setup invitations expire and can be used once. Customer portal access remains workshop-scoped and protected.</p>
        <p>Opening a draft cannot confirm that someone received or read it.</p>
      </section>
      <section className="wa-card">
        <h2><Copy size={20}/> Copy instead</h2>
        <p>If WhatsApp is unavailable, use Copy Message or Copy Link where offered and share it directly with the intended recipient.</p>
        <p><Link to="/staff-management">Manage Staff</Link> · <Link to="/customers">Customers</Link></p>
      </section>
    </main>
  );
}
export default WhatsAppSettingsPage;
