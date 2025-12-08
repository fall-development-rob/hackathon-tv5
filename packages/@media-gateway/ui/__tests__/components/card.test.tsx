/**
 * Card Component Tests
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../src/components/ui/card.js";

describe("Card", () => {
  it("renders Card component", () => {
    render(<Card data-testid="card">Card content</Card>);
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("renders complete Card structure", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Main content here</CardContent>
        <CardFooter>Footer content</CardFooter>
      </Card>
    );

    expect(screen.getByText("Card Title")).toBeInTheDocument();
    expect(screen.getByText("Card Description")).toBeInTheDocument();
    expect(screen.getByText("Main content here")).toBeInTheDocument();
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });

  it("applies custom className to Card", () => {
    render(
      <Card className="custom-card" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId("card")).toHaveClass("custom-card");
  });

  it("applies custom className to CardHeader", () => {
    render(
      <Card>
        <CardHeader className="custom-header" data-testid="header">
          Header
        </CardHeader>
      </Card>
    );
    expect(screen.getByTestId("header")).toHaveClass("custom-header");
  });

  it("applies custom className to CardTitle", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle className="custom-title" data-testid="title">
            Title
          </CardTitle>
        </CardHeader>
      </Card>
    );
    expect(screen.getByTestId("title")).toHaveClass("custom-title");
  });

  it("applies custom className to CardContent", () => {
    render(
      <Card>
        <CardContent className="custom-content" data-testid="content">
          Content
        </CardContent>
      </Card>
    );
    expect(screen.getByTestId("content")).toHaveClass("custom-content");
  });

  it("applies custom className to CardFooter", () => {
    render(
      <Card>
        <CardFooter className="custom-footer" data-testid="footer">
          Footer
        </CardFooter>
      </Card>
    );
    expect(screen.getByTestId("footer")).toHaveClass("custom-footer");
  });
});
