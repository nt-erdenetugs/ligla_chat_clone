import { ModelLink } from '~/common/components';
import { Show as FilterShow, FilterForm } from '~/modules/Rules/Filters';

type FilterLinkProps = {
  id: string;
  title: string;
  depth: Optional<number>;
};

export const FilterLink = ({ id, title, depth }: FilterLinkProps) => {
  return (
    !!id && (
      <ModelLink
        id={id}
        paramKey={`filter_${id}`}
        title={title}
        Show={FilterShow}
        Form={FilterForm}
        depth={depth}
      />
    )
  );
};
