-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Anyone can view templates (needed for edge functions)
CREATE POLICY "Anyone can view email templates"
ON public.email_templates
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default template
INSERT INTO public.email_templates (template_type, subject, html_content)
VALUES (
  'booking_confirmation_client',
  '✂️ Confirmation de votre rendez-vous - LCS Style',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmation de votre rendez-vous - LCS Style</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .total { background: #e3f2fd; font-weight: bold; font-size: 18px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    .info-box { margin-top: 30px; padding: 20px; background: #d4edda; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✂️ LCS Style</h1>
      <h2>Confirmation de votre rendez-vous</h2>
    </div>
    <div class="content">
      <p>Bonjour <strong>{{clientName}}</strong>,</p>
      
      <p>Votre rendez-vous a été confirmé avec succès ! Voici les détails :</p>
      
      <div class="detail-row">
        <span>Service :</span>
        <span><strong>{{serviceName}}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Date :</span>
        <span><strong>{{appointmentDate}}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Heure :</span>
        <span><strong>{{appointmentTime}}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Adresse :</span>
        <span><strong>{{clientAddress}}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Prix du service :</span>
        <span><strong>{{servicePrice}}€</strong></span>
      </div>
      
      {{#if travelFee}}
      <div class="detail-row">
        <span>Frais de déplacement :</span>
        <span><strong>{{travelFee}}€</strong></span>
      </div>
      {{/if}}
      
      <div class="detail-row total">
        <span>Total :</span>
        <span><strong>{{totalPrice}}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Acompte versé :</span>
        <span><strong>{{depositAmount}}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Reste à payer :</span>
        <span><strong>{{remainingAmount}}€</strong></span>
      </div>
      
      {{#if message}}
      <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px;">
        <strong>Votre message :</strong><br>
        {{message}}
      </div>
      {{/if}}
      
      <div class="info-box">
        <h3>📝 Informations importantes :</h3>
        <ul>
          <li>Merci d''être ponctuel à votre rendez-vous</li>
          <li>En cas d''empêchement, merci de nous prévenir au minimum 24h à l''avance</li>
          <li>Le solde de <strong>{{remainingAmount}}€</strong> sera à régler sur place</li>
        </ul>
      </div>
      
      <div class="footer">
        <p>Merci de votre confiance ! 🙏</p>
        <p><strong>LCS Style</strong><br>
        📞 Contactez-nous si vous avez des questions</p>
      </div>
    </div>
  </div>
</body>
</html>'
);