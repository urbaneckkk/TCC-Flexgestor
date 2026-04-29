// Controllers/PermissaoController.cs
using Microsoft.AspNetCore.Mvc;
using WebApplication5.Models;
using WebApplication5.Services;

public class PermissaoController : BaseController
{
    private readonly PermissaoService _service;
    private readonly AuditoriaService _auditoria;

    public PermissaoController(PermissaoService service, AuditoriaService auditoria)
    {
        _service = service;
        _auditoria = auditoria;
    }

    public IActionResult Index()
    {
        var r = VerificarSessao(); if (r != null) return r;

        var idCargo = HttpContext.Session.GetInt32("idCargo");
        if (idCargo != 1) return RedirectToAction("Index", "Home");

        return View();
    }

    public IActionResult ListarMenus(int idCargo)
    {
        var r = VerificarSessaoApi(); if (r != null) return r;
        var idEmpresa = HttpContext.Session.GetInt32("IdEmpresa")!.Value;
        return Json(_service.ListarMenus(idEmpresa, idCargo));
    }

    public IActionResult ListarCampos(int idCargo)
    {
        var r = VerificarSessaoApi(); if (r != null) return r;
        var idEmpresa = HttpContext.Session.GetInt32("IdEmpresa")!.Value;
        return Json(_service.ListarCampos(idEmpresa, idCargo));
    }

    [HttpPost]
    public IActionResult Salvar([FromBody] SalvarPermissoesDto dto)
    {
        var r = VerificarSessaoApi(); if (r != null) return r;
        var idCargo = HttpContext.Session.GetInt32("idCargo");
        if (idCargo != 1) return Unauthorized();

        var idEmpresa = HttpContext.Session.GetInt32("IdEmpresa")!.Value;
        _service.SalvarPermissoes(idEmpresa, dto);

        _auditoria.Registrar(new RegistrarAuditoriaDto
        {
            IdEmpresa = idEmpresa,
            IdUsuario = HttpContext.Session.GetInt32("idUsuario"),
            NomeUsuario = HttpContext.Session.GetString("nomeUsuario"),
            Modulo = "PERMISSAO",
            Acao = "SALVAR",
            Descricao = $"Permissões do cargo #{dto.IdCargo} atualizadas",
            IpUsuario = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        return Ok();
    }

    // Chamado pelo menu.js pra saber quais rotas o usuário pode ver
    public IActionResult MinhasPermissoes()
    {
        var r = VerificarSessaoApi(); if (r != null) return r;
        var idEmpresa = HttpContext.Session.GetInt32("IdEmpresa")!.Value;
        var idCargo = HttpContext.Session.GetInt32("idCargo") ?? 0;

        Console.WriteLine($"[DEBUG] idCargo={idCargo} idEmpresa={idEmpresa}");

        // Admin vê tudo sempre
        if (idCargo == 1)
            return Json(new { admin = true, rotas = new List<string>() });

        var rotas = _service.ListarRotasPermitidas(idEmpresa, idCargo);
        return Json(new { admin = false, rotas });
    }

    // Chamado pelo cliente.js pra saber quais campos renderizar
    public IActionResult CamposCliente()
    {
        var r = VerificarSessaoApi(); if (r != null) return r;
        var idEmpresa = HttpContext.Session.GetInt32("IdEmpresa")!.Value;
        var idCargo = HttpContext.Session.GetInt32("idCargo") ?? 0;

        // Admin vê e edita tudo
        if (idCargo == 1)
            return Json(new { admin = true, campos = new List<object>() });

        var campos = _service.ListarCamposDoUsuario(idEmpresa, idCargo);
        return Json(new { admin = false, campos });
    }
}