const urlRegex = /(https?:\/\/[^\s]+)/g;

type MessageText = {
  text: string;
  isLink: boolean;
};

export const convertUrlsToLinks = (message: string): MessageText[] => {
  return message
    .split(urlRegex)
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const isLink = /(https?:\/\/[^\s]+)/.test(chunk);
      return {
        text: chunk,
        isLink,
      };
    });
};
