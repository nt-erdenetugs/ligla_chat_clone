import { useEffect, useState } from 'react';

import * as qrCode from 'qrcode';
export const QRCode = (props: { value: string; size: number }) => {
  const [dataURL, setDataURL] = useState<string>();

  useEffect(() => {
    (async () => {
      const dataUrl = await qrCode.toDataURL(props.value, { width: props.size });
      setDataURL(dataUrl);
    })();
  }, [props.value, props.size]);

  return (
    <>
      <img src={dataURL} alt='qrcode' />
    </>
  );
};
