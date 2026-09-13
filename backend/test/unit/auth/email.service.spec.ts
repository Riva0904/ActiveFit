import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../../src/email/email.service';

/**
 * EmailService talks to the Resend HTTP API via global fetch (no nodemailer).
 * Every test inspects the JSON body that would have been POSTed.
 */

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ id: 'email_123' }), text: async () => '' });
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

const mockConfigService = {
  get: jest.fn((key: string, fallback?: any) => {
    const config: Record<string, any> = {
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM_ADDRESS: 'noreply@activeboost.test',
      FRONTEND_URL: 'http://localhost:3000',
    };
    return config[key] ?? fallback;
  }),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();
    service = module.get(EmailService);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse());
  });

  describe('sendMail', () => {
    it('POSTs to Resend with the bearer key and returns true', async () => {
      const result = await service.sendMail({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>' });

      expect(result).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer re_test_key');
      expect(sentBody()).toEqual({ from: 'ActiveBoost <noreply@activeboost.test>', to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>' });
    });

    it('returns false (does not throw) on a non-2xx response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'bad', json: async () => ({}) });
      await expect(service.sendMail({ to: 'u@x.com', subject: 's', html: 'h' })).resolves.toBe(false);
    });

    it('returns false on a network failure', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));
      await expect(service.sendMail({ to: 'u@x.com', subject: 's', html: 'h' })).resolves.toBe(false);
    });
  });

  describe('sendOtpEmail', () => {
    it('puts the code in subject and body, with expiry and security notice', async () => {
      const result = await service.sendOtpEmail('user@example.com', '847291', 'EMAIL_VERIFICATION', 'John');
      expect(result).toBe(true);
      const body = sentBody();
      expect(body.subject).toContain('847291');
      expect(body.subject).toContain('Verify Your Email');
      expect(body.html).toContain('847291');
      expect(body.html).toContain('John');
      expect(body.html).toContain('10 minutes');
      expect(body.html).toContain('Security Notice');
      expect(body.html).toContain('Never share');
    });

    it.each([
      ['EMAIL_VERIFICATION', 'Verify Your Email'],
      ['LOGIN_2FA', 'Login Verification'],
      ['PASSWORD_RESET', 'Reset Your Password'],
      ['SOMETHING_ELSE', 'OTP Verification'],
    ])('labels purpose %s as "%s"', async (purpose, label) => {
      await service.sendOtpEmail('u@x.com', '123456', purpose, 'User');
      expect(sentBody().subject).toContain(label);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('greets the member by name and mentions QR check-in', async () => {
      await service.sendWelcomeEmail('user@example.com', 'John', 'MEMBER');
      const body = sentBody();
      expect(body.subject).toBe('Welcome to ActiveBoost, John!');
      expect(body.html).toContain('John');
      expect(body.html).toContain('QR check-in');
    });
  });

  describe('sendMembershipRenewalReminder', () => {
    it('includes plan type and days remaining in the subject', async () => {
      await service.sendMembershipRenewalReminder('u@x.com', 'John', 5, 'MONTHLY');
      const body = sentBody();
      expect(body.subject).toContain('MONTHLY');
      expect(body.subject).toContain('5 days');
      expect(body.html).toContain('days remaining');
    });

    it('escalates the heading to urgent at ≤2 days', async () => {
      await service.sendMembershipRenewalReminder('u@x.com', 'John', 1, 'MONTHLY');
      expect(sentBody().html).toContain('Urgent');
    });
  });

  describe('sendPaymentConfirmation', () => {
    it('includes invoice number and PAID status', async () => {
      await service.sendPaymentConfirmation('u@x.com', 'John', 2999, 'INV-001');
      const body = sentBody();
      expect(body.subject).toContain('INV-001');
      expect(body.html).toContain('INV-001');
      expect(body.html).toContain('PAID');
    });
  });

  describe('sendAccountCreatedEmail', () => {
    it('shows the role label, temporary password and member code', async () => {
      await service.sendAccountCreatedEmail('u@x.com', 'Sam', 'TRAINER', 'Temp@123', 'FH-0042');
      const body = sentBody();
      expect(body.subject).toContain('Trainer');
      expect(body.html).toContain('Temp@123');
      expect(body.html).toContain('FH-0042');
      expect(body.html).toContain('http://localhost:3000/login');
    });
  });

  describe('sendPasswordChangedAlert', () => {
    it('sends the alert', async () => {
      await service.sendPasswordChangedAlert('u@x.com', 'John');
      const body = sentBody();
      expect(body.to).toBe('u@x.com');
      expect(body.subject.toLowerCase()).toContain('password');
    });
  });

  describe('verifyConnection', () => {
    it('is true when an API key is configured (no network probe)', async () => {
      await expect(service.verifyConnection()).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is false when no API key is configured', async () => {
      const module = await Test.createTestingModule({
        providers: [EmailService, { provide: ConfigService, useValue: { get: (_k: string, d?: any) => d } }],
      }).compile();
      await expect(module.get(EmailService).verifyConnection()).resolves.toBe(false);
    });
  });
});
