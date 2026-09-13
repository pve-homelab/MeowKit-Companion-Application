import { Component, type ErrorInfo, type ReactNode } from 'react';
import Alert from '@meowkit/components/alert';
import Box from '@meowkit/components/box';
import Container from '@meowkit/components/container';
import Header from '@meowkit/components/header';

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.title}] render error`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Container header={<Header variant="h1">{this.props.title}</Header>}>
          <Alert type="error">
            This view crashed: {this.state.error.message}. Try reloading the app. If it persists,
            open DevTools for details.
          </Alert>
          <Box as="pre" color="muted" fontSize="sm">
            {this.state.error.stack}
          </Box>
        </Container>
      );
    }
    return this.props.children;
  }
}
