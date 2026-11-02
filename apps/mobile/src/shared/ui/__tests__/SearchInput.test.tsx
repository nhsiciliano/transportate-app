import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SearchInput } from '..';
import { renderThemed } from '../__fixtures__/renderThemed';

function Controlled({ onClear }: { onClear: () => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchInput label="Buscar estación" value={value} onChangeText={setValue} onClear={onClear} />
  );
}

describe('SearchInput', () => {
  it('el botón "Borrar búsqueda" aparece con texto y lo limpia', async () => {
    const onClear = jest.fn();
    await renderThemed(<Controlled onClear={onClear} />);
    const input = screen.getByLabelText('Buscar estación');
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();

    await fireEvent.changeText(input, 'Callao');
    expect(input).toHaveDisplayValue('Callao');

    await fireEvent.press(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(input).toHaveDisplayValue('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
  });

  it('teclado de búsqueda y placeholder con el color del tema', async () => {
    await renderThemed(
      <SearchInput label="Buscar línea" value="" onChangeText={jest.fn()} />,
      'dark',
    );
    const input = screen.getByLabelText('Buscar línea');
    expect(input.props.returnKeyType).toBe('search');
    expect(input.props.placeholder).toBe('Buscar línea');
  });
});
