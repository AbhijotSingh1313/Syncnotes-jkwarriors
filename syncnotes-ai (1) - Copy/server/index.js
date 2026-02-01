import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/send-report', async (req, res) => {
  try {
    const { meeting, recipients, link } = req.body;
    if (!meeting || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'Missing meeting or recipients' });
    }

    // Generate PDF
    const doc = new PDFDocument({ autoFirstPage: true });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // Configure transporter using env vars
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP_USER or SMTP_PASS not set. Email will not be sent.');
      }

      const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: recipients.join(','),
        subject: `Published Meeting: ${meeting.title}`,
        text: `Your meeting has been published. View it here: ${link}`,
        attachments: [
          { filename: `report-${meeting.id}.pdf`, content: pdfBuffer }
        ]
      };

      try {
        await transporter.sendMail(mailOptions);
        res.json({ ok: true });
      } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email', details: String(err) });
      }
    });

    // Compose PDF content
    doc.fontSize(18).text(meeting.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${meeting.date} ${meeting.time}`);
    doc.text(`Agenda: ${meeting.agenda}`);
    doc.moveDown();

    doc.fontSize(14).text('Summary');
    doc.fontSize(11).text(meeting.summary || 'N/A');
    doc.moveDown();

    doc.fontSize(14).text('Conclusion');
    doc.fontSize(11).text(meeting.conclusion || 'N/A');
    doc.moveDown();

    doc.fontSize(14).text('Tasks');
    (meeting.tasks || []).forEach((t, idx) => {
      doc.fontSize(11).text(`${idx + 1}. ${t.title} — ${t.assignee} [${t.status || 'pending'}]`);
    });

    doc.end();
  } catch (err) {
    console.error('Unexpected error in /send-report:', err);
    res.status(500).json({ error: String(err) });
  }
});

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Email server listening on http://localhost:${port}`));
