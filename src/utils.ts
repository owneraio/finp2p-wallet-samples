import { CustodyAdapter } from '@owneraio/finp2p-sdk-js';

export const delay = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

export const signingMethod = (r: { custody: CustodyAdapter, accountId: string }) => async (hash: string) => {
  let attempt = 0;
  let signatureResponse = await (r.custody.createSignature({ id: r.accountId, hash }));
  const signatureId = signatureResponse.id;
  const doRetry = !['FAILED', 'COMPLETED'].includes(signatureResponse.status);
  while (doRetry && attempt < 10) {
    signatureResponse = await r.custody.getSignature({ signatureId });
    attempt = attempt + 1;
  }

  if (doRetry && attempt === 10) {
    throw {
      code: 408,
      name: 'SignatureError',
      message: 'Timeout - unable to get signature',
      data: signatureResponse,
    };
  }

  if (signatureResponse.status === 'FAILED') {
    throw {
      code: 500,
      name: 'SignatureError',
      message: 'Failure - unable to get signature',
      data: signatureResponse,
    };
  }

  return Promise.resolve(signatureResponse.signature);
};
