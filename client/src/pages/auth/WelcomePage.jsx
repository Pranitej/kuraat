import { useState } from 'react';
import { Button, Logo, Modal } from '@/components/ui';
import { welcomeHero } from '@/assets/images.js';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

const LEGAL = {
  terms: {
    title: 'Terms of use',
    body: [
      'Orders are prepared fresh by the kuraat branch nearest to your delivery address and delivered within the time slot shown at checkout.',
      'Prices are in Saudi riyals and include 15% VAT. Delivery is charged at SAR 15.00 per order.',
      'You can cancel an order free of charge until the branch starts preparing it. Perishable items cannot be returned once delivered.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We use your name, mobile number and delivery addresses only to process and deliver your orders and to send order updates on WhatsApp.',
      'Payment details are handled by our payment provider and are never stored on your device in full.',
      'You can update or delete your account details at any time from your profile.',
    ],
  },
};

/** 02 · Welcome */
export default function WelcomePage() {
  useDocumentTitle('Welcome');
  const [legal, setLegal] = useState(null);
  const doc = legal ? LEGAL[legal] : null;

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-2">
      <div className="relative h-[52dvh] min-h-[300px] max-h-[470px] overflow-hidden lg:sticky lg:top-0 lg:h-dvh lg:max-h-none">
        <img src={welcomeHero} alt="kuraat signature maroon truffle box" className="size-full animate-fade-in object-cover object-[50%_40%]" />
      </div>

      <main className="relative -mt-7 rounded-t-sheet bg-cream lg:mt-0 lg:flex lg:items-center lg:rounded-none">
        <div className="mx-auto flex max-w-column animate-fade-up flex-col items-center px-6 pb-10 pt-9 text-center lg:max-w-form lg:px-0">
          <Logo className="w-[132px] lg:w-[160px]" />
          <h1 className="mt-5 text-title text-ink lg:text-[34px] lg:leading-10">Welcome to kuraat</h1>
          <p className="mt-2 max-w-[330px] text-body text-muted">Fresh truffles, cakes and pastries, delivered from the branch nearest you.</p>
          <div className="mt-8 flex w-full flex-col gap-3">
            <Button to={ROUTES.signUp} block>
              Create an account
            </Button>
            <Button to={ROUTES.signIn} variant="secondary" block>
              Sign in
            </Button>
          </div>
          <p className="mt-7 text-label font-normal text-muted">
            By continuing you agree to our{' '}
            <button type="button" onClick={() => setLegal('terms')} className="font-bold text-maroon hover:underline">
              Terms
            </button>{' '}
            and{' '}
            <button type="button" onClick={() => setLegal('privacy')} className="font-bold text-maroon hover:underline">
              Privacy Policy
            </button>
          </p>
        </div>
      </main>

      <Modal open={Boolean(doc)} onClose={() => setLegal(null)} labelledBy="legal-title" size="md">
        {doc && (
          <div>
            <h2 id="legal-title" className="text-heading text-ink">
              {doc.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-body text-copy">
              {doc.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <Button block className="mt-6" onClick={() => setLegal(null)} data-autofocus>
              Got it
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
