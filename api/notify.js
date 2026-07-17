module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(500).json({ error: 'missing RESEND_API_KEY env var' }); return; }
  const TO = process.env.NOTIFY_TO || 'gustavo.coelho@lurielabs.com.br';
  const FROM = process.env.NOTIFY_FROM || 'Lurie Labs <briefing@bnnylabs.com>';

  const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const slug = (s) => ((s || 'briefing').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'briefing');

  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b || {};
    const emp = b.empreendimento || 'Empreendimento';
    const payload = { from: FROM, to: [TO] };

    if (b.type === 'inicio') {
      payload.subject = 'Briefing iniciado - ' + emp;
      payload.html = '<div style="font-family:Arial,sans-serif;color:#1b1c1e">'
        + '<p>Um cliente <b>comecou a preencher</b> o briefing de <b>' + esc(emp) + '</b>.</p>'
        + '<p style="color:#6b6f76;font-size:13px">As respostas ja estao sendo salvas no Supabase. Voce recebe o resumo completo + PDF quando ele concluir.</p></div>';
    } else {
      payload.subject = 'Briefing concluido - ' + emp;
      const sections = Array.isArray(b.sections) ? b.sections : [];
      let rows = '';
      for (const s of sections) {
        rows += '<tr><td colspan="2" style="padding:16px 0 4px;font-weight:700;font-size:14px;color:#1f1c4a">' + esc(s.title) + '</td></tr>';
        for (const r of (s.rows || [])) {
          rows += '<tr><td style="padding:4px 14px 4px 0;vertical-align:top;font-size:11px;color:#6b6f76">' + esc(r.label)
            + '</td><td style="padding:4px 0;font-size:13px;white-space:pre-wrap">' + (esc(r.value) || '-') + '</td></tr>';
        }
      }
      payload.html = '<div style="font-family:Arial,sans-serif;color:#1b1c1e;max-width:680px">'
        + '<div style="border-bottom:3px solid #00d452;padding-bottom:10px;margin-bottom:8px">'
        + '<div style="font-size:11px;letter-spacing:2px;color:#5849f1;font-weight:700">LURIE LABS - BRIEFING CONCLUIDO</div>'
        + '<div style="font-size:22px;font-weight:800;margin-top:4px">' + esc(emp) + '</div></div>'
        + '<table style="border-collapse:collapse;width:100%">' + rows + '</table>'
        + '<p style="color:#9aa0a2;font-size:11px;margin-top:16px">PDF em anexo. Registro completo tambem no Supabase.</p></div>';
      if (b.pdf) { payload.attachments = [{ filename: 'briefing-' + slug(emp) + '.pdf', content: b.pdf }]; }
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(502).json({ error: 'resend_error', detail: data }); return; }
    res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
