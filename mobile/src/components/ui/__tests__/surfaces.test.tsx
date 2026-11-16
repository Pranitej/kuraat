import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ConfirmDialog, Dialog, OtpInput } from '@/components/ui';
import { ToastProvider, useToast } from '@/context/ToastContext';

describe('Dialog', () => {
  test('Android back (onRequestClose) closes it', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog open onClose={onClose} title="Your order will be delivered from">
        <Text>Kuraat · Al Khobar Corniche</Text>
      </Dialog>,
    );
    expect(screen.getByText('Kuraat · Al Khobar Corniche')).toBeTruthy();
    await fireEvent(screen.getByTestId('dialog'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('while its action is loading, back does not close it', async () => {
    const onClose = jest.fn();
    await render(
      <ConfirmDialog open loading onClose={onClose} onConfirm={() => {}} title="Delete address?" confirmLabel="Delete address" />,
    );
    await fireEvent(screen.getByTestId('dialog'), 'requestClose');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('ConfirmDialog: confirm and cancel', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    await render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Log out?" confirmLabel="Log out" cancelLabel="Stay signed in" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function ToastButton({ withAction }: { withAction?: () => void }) {
  const toast = useToast();
  return (
    <Text
      onPress={() =>
        toast.show('Truffle Box · Classic removed', withAction ? { action: { label: 'Undo', onPress: withAction } } : undefined)
      }
    >
      show
    </Text>
  );
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('hides itself after 2.8 s', async () => {
    await render(
      <ToastProvider>
        <ToastButton />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByText('show'));
    expect(screen.getByText('Truffle Box · Classic removed')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2700);
    });
    expect(screen.queryByText('Truffle Box · Classic removed')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Truffle Box · Classic removed')).toBeNull();
  });

  test('the action button keeps its size and its label on one line', async () => {
    const { StyleSheet } = require('react-native');
    await render(
      <ToastProvider>
        <ToastButton withAction={() => {}} />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByText('show'));
    const action = screen.getByRole('button', { name: 'Undo' });
    expect(StyleSheet.flatten(action.props.style).flexShrink).toBe(0);
    expect(screen.getByText('Undo').props.numberOfLines).toBe(1);
  });

  test('an action runs its handler and closes the toast', async () => {
    const undo = jest.fn();
    await render(
      <ToastProvider>
        <ToastButton withAction={undo} />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByText('show'));
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Truffle Box · Classic removed')).toBeNull();
  });
});

describe('OtpInput', () => {
  test('keeps digits only, up to 6, and reports completion', async () => {
    const onChange = jest.fn();
    const onComplete = jest.fn();
    await render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '12a3 4567');
    expect(onChange).toHaveBeenLastCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  test('shows each digit in its own cell', async () => {
    await render(<OtpInput value="482" onChange={() => {}} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
