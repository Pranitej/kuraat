import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Field, PhoneField, Segmented, Stepper, Toggle } from '@/components/ui';

describe('Button', () => {
  test('calls onPress once per tap', async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Sign in</Button>);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('while loading: spinner instead of the label, busy and not pressable', async () => {
    const onPress = jest.fn();
    await render(
      <Button loading onPress={onPress}>
        Pay SAR 328.00
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Stepper', () => {
  test('"−" at the minimum asks to remove instead of changing the quantity', async () => {
    const onChange = jest.fn();
    const onRemoveAtMin = jest.fn();
    await render(<Stepper value={1} onChange={onChange} onRemoveAtMin={onRemoveAtMin} />);
    await fireEvent.press(screen.getByLabelText('Decrease quantity'));
    expect(onRemoveAtMin).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('"+" stops at 20', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={20} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('"+" adds one', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={2} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('fields', () => {
  test('PhoneField shows the 50 123 4821 grouping and reports digits only', async () => {
    const onChange = jest.fn();
    await render(<PhoneField value="501234821" onChange={onChange} />);
    const input = screen.getByDisplayValue('50 123 4821');
    await fireEvent.changeText(input, '55 999 88 77 66');
    expect(onChange).toHaveBeenLastCalledWith('559998877');
  });

  test('Field shows its error under the input', async () => {
    await render(<Field label="Full name" value="" onChangeText={() => {}} error="Enter your full name" />);
    expect(screen.getByText('Enter your full name')).toBeTruthy();
    expect(screen.getByText('Full name')).toBeTruthy();
  });
});

describe('selection controls', () => {
  test('Segmented reports the chosen option', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={[
          { value: 'password', label: 'Password' },
          { value: 'otp', label: 'WhatsApp code' },
        ]}
        value="password"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Password' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'WhatsApp code' }));
    expect(onChange).toHaveBeenCalledWith('otp');
  });

  test('Toggle flips its value', async () => {
    const onChange = jest.fn();
    await render(<Toggle value={false} onChange={onChange} label="Make this my default address" />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Make this my default address' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Tag', () => {
  test('lets its row centre it vertically (no alignSelf of its own)', async () => {
    const { StyleSheet } = require('react-native');
    const { Tag } = require('@/components/ui');
    await render(<Tag tone="dark">2.4 km</Tag>);
    const pill = screen.getByText('2.4 km').parent;
    expect(StyleSheet.flatten(pill?.props.style).alignSelf).toBeUndefined();
  });
});
