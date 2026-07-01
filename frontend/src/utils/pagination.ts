export const convertToBackendPagination = ({ per, page }: { per: number; page: number }) => {
  return {
    skip: per * (page - 1),
    take: per,
  };
};
