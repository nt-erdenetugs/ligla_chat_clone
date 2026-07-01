import { Card, type CardProps, TitleCaption } from '~/common/components';

type TitleProps = CardProps & {
  title: string;
  subTitle?: string;
};

export const Title = ({ title, subTitle, children, ...rest }: TitleProps) => {
  return (
    <Card
      direction='row'
      alignItems='center'
      justifyContent='space-between'
      py={2}
      px={3}
      mb={2}
      {...rest}
    >
      <TitleCaption primary={title} secondary={subTitle} width='100%'>
        {children}
      </TitleCaption>
    </Card>
  );
};
