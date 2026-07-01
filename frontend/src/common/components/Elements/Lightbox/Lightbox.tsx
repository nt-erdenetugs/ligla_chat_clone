import { useRef } from 'react';

import { ChevronLeft, ChevronRight, Close, ZoomOut } from '@mui/icons-material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ReactLightbox, { useLightboxState, type ZoomRef } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Video from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

import StyledLightbox from './styles';
import { type LightBoxProps } from './types';

import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

export default function Lightbox({
  slides,
  disabledZoom,
  disabledVideo,
  disabledTotal,
  disabledCaptions,
  disabledSlideshow,
  disabledThumbnails,
  disabledFullscreen,
  onGetCurrentIndex,
  ...other
}: LightBoxProps) {
  const totalItems = slides ? slides.length : 0;

  const zoomRef = useRef<ZoomRef>(null);

  const resetZoom = () => {
    if (zoomRef.current) {
      zoomRef.current.changeZoom(1);
    }
  };

  return (
    <>
      <StyledLightbox />

      <ReactLightbox
        slides={slides}
        animation={{ swipe: 240 }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        plugins={getPlugins({
          disabledZoom,
          disabledVideo,
          disabledCaptions,
          disabledSlideshow,
          disabledThumbnails,
          disabledFullscreen,
        })}
        on={{
          view: ({ index }: { index: number }) => {
            if (onGetCurrentIndex) {
              onGetCurrentIndex(index);
            }
          },
        }}
        toolbar={{
          buttons: [
            <DisplayTotal key={0} totalItems={totalItems} disabledTotal={disabledTotal} />,
            <IconButton key={1} onClick={resetZoom} sx={{ p: 1 }}>
              <ZoomOut sx={{ color: 'white', opacity: '75%' }} />
            </IconButton>,
            'close',
          ],
        }}
        render={{
          iconClose: () => <Close fontSize='medium' />,
          iconZoomIn: () => undefined,
          iconZoomOut: () => undefined,
          iconSlideshowPlay: () => undefined,
          iconSlideshowPause: () => undefined,
          iconPrev: () => <ChevronLeft fontSize='large' />,
          iconNext: () => <ChevronRight fontSize='large' />,
          iconExitFullscreen: () => undefined,
          iconEnterFullscreen: () => undefined,
        }}
        zoom={{
          ref: zoomRef,
          scrollToZoom: true,
          maxZoomPixelRatio: 5,
        }}
        {...other}
      />
    </>
  );
}

export function getPlugins({
  disabledZoom,
  disabledVideo,
  disabledCaptions,
  disabledSlideshow,
  disabledThumbnails,
  disabledFullscreen,
}: LightBoxProps) {
  let plugins = [Captions, Fullscreen, Slideshow, Thumbnails, Video, Zoom];

  if (disabledThumbnails) {
    plugins = plugins.filter((plugin) => plugin !== Thumbnails);
  }
  if (disabledCaptions) {
    plugins = plugins.filter((plugin) => plugin !== Captions);
  }
  if (disabledFullscreen) {
    plugins = plugins.filter((plugin) => plugin !== Fullscreen);
  }
  if (disabledSlideshow) {
    plugins = plugins.filter((plugin) => plugin !== Slideshow);
  }
  if (disabledZoom) {
    plugins = plugins.filter((plugin) => plugin !== Zoom);
  }
  if (disabledVideo) {
    plugins = plugins.filter((plugin) => plugin !== Video);
  }
  return plugins;
}

type DisplayTotalProps = {
  totalItems: number;
  disabledTotal?: boolean;
};

export function DisplayTotal({ totalItems, disabledTotal }: DisplayTotalProps) {
  const { currentIndex } = useLightboxState();

  if (disabledTotal) {
    return null;
  }

  return (
    <Box
      component='span'
      className='yarl__button'
      sx={{
        typography: 'body2',
        alignItems: 'center',
        display: 'inline-flex',
        justifyContent: 'center',
      }}
    >
      <strong> {currentIndex + 1} </strong> / {totalItems}
    </Box>
  );
}
