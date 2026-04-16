"""
template_engine.py
------------------
Thin Jinja2 wrapper that loads prompt templates from the `prompt_templates/`
directory and renders them with the provided context variables.

Usage:
    from src.services.template_engine import render_template

    system_prompt = render_template("base_system.j2")
    user_prompt   = render_template("diagnosis.j2", age=45, gender="Male", ...)
"""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
import logging

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent / "prompt_templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    trim_blocks=True,
    lstrip_blocks=True,
    keep_trailing_newline=True,
)


def render_template(template_name: str, **kwargs) -> str:
    """
    Render a Jinja2 template file from the prompt_templates directory.

    Args:
        template_name: Filename of the template (e.g. "diagnosis.j2")
        **kwargs:       Variables to inject into the template

    Returns:
        Rendered string ready to be sent to the AI API

    Raises:
        FileNotFoundError: If the template file does not exist
    """
    try:
        template = _env.get_template(template_name)
        rendered = template.render(**kwargs)
        logger.debug(f"Rendered template '{template_name}' ({len(rendered)} chars)")
        return rendered
    except TemplateNotFound:
        raise FileNotFoundError(
            f"Prompt template '{template_name}' not found in {_TEMPLATE_DIR}. "
            f"Available templates: {list_templates()}"
        )


def list_templates() -> list[str]:
    """Return a list of all available template filenames."""
    return [p.name for p in _TEMPLATE_DIR.glob("*.j2")]
